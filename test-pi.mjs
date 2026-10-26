// Run with Node 24+: node test-pi.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import gitInterceptor from "./home/.pi/agent/extensions/git-interceptor.ts";
import saveMarkdown from "./home/.pi/agent/extensions/save-md.ts";

let intercept;
gitInterceptor({ on: (name, handler) => { assert.equal(name, "tool_call"); intercept = handler; } });
const event = (command, toolName = "bash") => ({ toolName, input: { command } });
const git = event("git commit -m test");
assert.equal(intercept(git), undefined);
assert.ok(git.input.command.startsWith("export GIT_EDITOR=true GIT_SEQUENCE_EDITOR=true GIT_MERGE_AUTOEDIT=no\n"));
assert.equal(execFileSync("bash", ["-c", git.input.command.replace("git commit -m test", 'printf "%s %s %s" "$GIT_EDITOR" "$GIT_SEQUENCE_EDITOR" "$GIT_MERGE_AUTOEDIT"')], { encoding: "utf8" }), "true true no");
assert.equal(intercept(event("git commit --no-verify -m test")).block, true);
const unrelated = event("printf hello");
assert.equal(intercept(unrelated), undefined);
assert.equal(unrelated.input.command, "printf hello");
assert.equal(intercept(event("git --no-verify", "read")), undefined);

const cwd = await mkdtemp(join(tmpdir(), "dotfiles-pi-"));
try {
  let handler;
  const messages = [], notices = [];
  saveMarkdown({
    registerCommand: (name, command) => { assert.equal(name, "save-md"); handler = command.handler; },
    sendMessage: (...args) => messages.push(args),
  });
  let branch = [];
  let waited = false;
  const ctx = {
    cwd,
    waitForIdle: async () => { waited = true; },
    sessionManager: { getBranch: () => { assert.ok(waited); return branch; } },
    ui: { notify: (...args) => notices.push(args) },
  };
  const latestNotice = () => notices.at(-1);
  await handler("", ctx);
  assert.match(latestNotice()[0], /Usage/);
  await handler("empty", ctx);
  assert.match(latestNotice()[0], /No assistant/);
  branch = [{ type: "message", message: { role: "assistant", content: [
    { type: "thinking", thinking: "private" }, { type: "toolCall", name: "bash" },
  ] } }];
  await handler("thinking", ctx);
  assert.match(latestNotice()[0], /no Markdown/);
  branch.unshift({ type: "message", message: { role: "assistant", content: [{ type: "text", text: "older" }] } });
  branch.push({ type: "message", message: { role: "assistant", content: [
    { type: "text", text: "# Report" }, { type: "thinking", thinking: "private" },
    { type: "text", text: "Body" }, { type: "toolCall", name: "bash" },
  ] } }, { type: "message", message: { role: "user", content: "not this" } });
  await handler(" report ", ctx);
  const report = join(cwd, "report.md");
  assert.equal(await readFile(report, "utf8"), "# Report\n\nBody\n");
  assert.equal(messages[0][1].deliverAs, "nextTurn");
  assert.match(messages[0][0].content, /report.md/);
  await handler("report.md", ctx);
  assert.equal(latestNotice()[1], "error");
  assert.equal(await readFile(report, "utf8"), "# Report\n\nBody\n");
  await symlink(report, join(cwd, "link.md"));
  await handler("link.md", ctx);
  assert.equal(latestNotice()[1], "error");
  assert.equal(messages.length, 1);
  await handler("missing/report", ctx);
  assert.equal(latestNotice()[1], "error");
  await handler("uppercase.MD", ctx);
  assert.equal(await readFile(join(cwd, "uppercase.MD"), "utf8"), "# Report\n\nBody\n");
} finally {
  await rm(cwd, { recursive: true, force: true });
}

let settings;
try {
  settings = JSON.parse(await readFile(new URL("./home/.pi/agent/settings.json", import.meta.url), "utf8"));
} catch (error) {
  assert.fail(`Pi settings must be valid JSON: ${error}`);
}
assert.ok(settings.packages.every((p) => !["npm:pi-context-view", "npm:remote-pi"].includes(typeof p === "string" ? p : p.source)));
assert.ok(settings.skills.every((p) => /^-?~\//.test(p)));
const ignored = ["home/.pi/agent/auth.json", "home/.pi/agent/mcp-auth.json", "home/.pi/agent/mcp-oauth/token.json", "home/.pi/agent/mcp-cache.json", "home/.pi/agent/npm/package.json", "home/.pi/agent/git/repo/a.ts", "home/.pi/agent/sessions/test.jsonl", ".pi/sessions/test.jsonl", "home/.pi/agent/extensions/tool/node_modules/test.js"];
assert.deepEqual(execFileSync("git", ["check-ignore", "--no-index", "--stdin"], { input: ignored.join("\n") + "\n", encoding: "utf8", cwd: new URL(".", import.meta.url) }).trim().split("\n"), ignored);
for (const path of ["home/.pi/agent/settings.json", "home/.pi/agent/mcp.json", "home/.pi/agent/cloak.json", "home/.pi/agent/extensions/save-md.ts", "home/.agents/skills/herdr/SKILL.md"]) {
  assert.throws(() => execFileSync("git", ["check-ignore", "--no-index", path], { cwd: new URL(".", import.meta.url) }), { status: 1 });
}
console.log("Pi checks passed: Git guard, Markdown saving, portable paths, package removal, and ignore rules.");
