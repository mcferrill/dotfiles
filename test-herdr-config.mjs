import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, lstatSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = mkdtempSync(join(tmpdir(), "herdr-config-"));
const app = join(root, "app home");
const bin = join(root, "bin");
const log = join(root, "commands");
const layout = "main-smart-nav-insights";
try {
  mkdirSync(bin);
  mkdirSync(app);
  writeFileSync(join(bin, "herdr-app"), `#!/bin/sh
printf '%s\\n' "$@" >> "$HERDR_TEST_LOG"
case "$1" in
  status) exit "$HERDR_TEST_RUNNING" ;;
  do) exit "$HERDR_TEST_SWITCH_EXIT" ;;
esac
`, { mode: 0o755 });
  const setup = (running = false, switchExit = "0") => spawnSync(process.execPath,
    [resolve("bin/herdr-app-setup"), app], {
      encoding: "utf8",
      env: { ...process.env, PATH: bin, HERDR_TEST_LOG: log,
        HERDR_TEST_RUNNING: running ? "0" : "1", HERDR_TEST_SWITCH_EXIT: switchExit },
    });
  const statePath = join(app, "shared.json");
  const initial = { layout: "old", "space.colors": { privateId: "ansi2" }, custom: [1] };
  writeFileSync(statePath, JSON.stringify(initial));
  assert.equal(setup().status, 0);
  assert.deepEqual(JSON.parse(readFileSync(statePath)), {
    ...initial, layout, "frame.welcomed": "finished",
  });
  const runtimePath = join(app, "mods/insights/runtime.json");
  assert.deepEqual(JSON.parse(readFileSync(runtimePath)), { node: process.execPath });
  const backups = () => readdirSync(app).filter(name => name.startsWith("shared.json.backup."));
  assert.equal(backups().length, 1);
  assert.deepEqual(JSON.parse(readFileSync(join(app, backups()[0]))), initial);
  assert.equal(setup().status, 0);
  assert.equal(backups().length, 1, "repeat setup should not back up unchanged state");

  writeFileSync(runtimePath, '{"node":"/old/node"}');
  assert.equal(setup().status, 0);
  assert.equal(JSON.parse(readFileSync(runtimePath)).node, process.execPath);
  assert.equal(readdirSync(join(app, "mods/insights")).filter(n => n.includes(".backup.")).length, 1);

  for (const invalid of ["{broken", "[]", "null"]) {
    writeFileSync(statePath, invalid);
    assert.notEqual(setup().status, 0);
    assert.equal(readFileSync(statePath, "utf8"), invalid, "invalid state must not be overwritten");
  }
  writeFileSync(statePath, JSON.stringify(initial));
  assert.equal(setup(true).status, 0);
  assert.deepEqual(JSON.parse(readFileSync(statePath)), initial, "running app owns shared.json");
  assert.ok(readFileSync(log, "utf8").includes(`do\nlayout.switch\n--name\n${layout}\n`));
  assert.notEqual(setup(true, "1").status, 0, "CLI failure must be reported");
  rmSync(statePath);
  assert.equal(setup().status, 0);
  assert.equal(JSON.parse(readFileSync(statePath)).layout, layout);

  // Only custom mods need vendoring; Herdr supplies these built-ins.
  const shipped = new Set(["workspace-chrome", "workspace-status", "files", "spaces", "agents"]);
  const config = resolve("home/.config/herdr-app");
  function checkLayout(node) {
    if (node.content?.mod && !shipped.has(node.content.mod)) {
      const folder = join(config, "mods", node.content.mod);
      assert.ok(existsSync(join(folder, "main.js")), `missing mod ${node.content.mod}`);
      JSON.parse(readFileSync(join(folder, "mod.json")));
    }
    for (const child of node.children ?? []) checkLayout(child);
  }
  checkLayout(JSON.parse(readFileSync(join(config, "layouts", `${layout}.json`))));
  const targetHome = join(root, "new machine");
  const install = (...args) => spawnSync("/bin/bash", [resolve("install"), ...args], {
    encoding: "utf8",
    env: { ...process.env, DOT_HOME: targetHome, PATH: `${bin}:${process.env.PATH}`,
      HERDR_TEST_LOG: log, HERDR_TEST_RUNNING: "1", HERDR_TEST_SWITCH_EXIT: "0" },
  });
  const dryRun = install("--dry-run", "link");
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.equal(existsSync(targetHome), false, "dry-run must not write files");
  const linked = install("link");
  assert.equal(linked.status, 0, linked.stderr);
  const installed = join(targetHome, ".config/herdr-app");
  const modFile = join(installed, "mods/insights/main.js");
  const modSource = join(config, "mods/insights/main.js");
  const assertCopied = () => {
    assert.equal(lstatSync(modFile).isSymbolicLink(), false);
    assert.equal(readFileSync(modFile, "utf8"), readFileSync(modSource, "utf8"));
  };
  assertCopied();
  // Migrate the old per-file symlinks without touching repository sources.
  rmSync(modFile);
  symlinkSync(modSource, modFile);
  assert.equal(install("link").status, 0);
  assertCopied();
  writeFileSync(modFile, "local changes");
  assert.equal(install("link").status, 0);
  assertCopied();
  const modBackups = () => readdirSync(join(installed, "mods/insights")).filter(n => n.startsWith("main.js.backup."));
  assert.equal(modBackups().length, 1);
  assert.equal(readFileSync(join(installed, "mods/insights", modBackups()[0]), "utf8"), "local changes");
  assert.equal(install("link").status, 0);
  assert.equal(modBackups().length, 1, "unchanged copies must not be backed up again");
  const diagnosis = install("doctor");
  assert.equal(diagnosis.status, 0, diagnosis.stderr);
  assert.ok(diagnosis.stdout.includes(`ok (copy): ${modFile}`));
  assert.equal(JSON.parse(readFileSync(join(installed, "shared.json"))).layout, layout);
  assert.ok(existsSync(JSON.parse(readFileSync(join(installed, "mods/insights/runtime.json"))).node));
  console.log("Herdr config checks passed (setup, backups, runtime, CLI, layout dependencies, install, dry-run).");
} finally {
  rmSync(root, { recursive: true, force: true });
}
