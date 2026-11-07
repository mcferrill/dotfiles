// Provider-reported subscription quotas only; never infer allowances from token totals.
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

export const STALE_MS = 5 * 60 * 1000;
const MAX_INPUT = 1024 * 1024;
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" ? value.slice(0, 120) : null;
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;

export function quotaWindow(label, percent, reset, now = Date.now()) {
  if (typeof percent !== "number" || !Number.isFinite(percent) || percent < 0 || percent > 100) return null;
  const resetsAt = typeof reset === "number" && Number.isFinite(reset) && reset > 0 && reset < 8640000000000 ? reset * 1000 : null;
  return { label, usedPercent: percent, remainingPercent: 100 - percent, resetsAt,
    expired: resetsAt !== null && resetsAt <= now };
}

export function normalizeCodex(result, now = Date.now()) {
  if (!record(result)) throw new Error("Invalid Codex quota response");
  const buckets = record(result.rateLimitsByLimitId) && Object.keys(result.rateLimitsByLimitId).length
    ? Object.entries(result.rateLimitsByLimitId) : [["codex", result.rateLimits]];
  const windows = [];
  for (const [id, bucket] of buckets) {
    if (!record(bucket)) continue;
    for (const key of ["primary", "secondary"]) {
      const w = bucket[key];
      if (!record(w)) continue;
      const mins = w.windowDurationMins;
      const duration = typeof mins === "number" && mins > 0 ? (mins % 60 === 0 ? `${mins / 60}h` : `${mins}m`) : key;
      const normalized = quotaWindow(`${text(bucket.limitName) || text(id)} · ${duration}`, w.usedPercent, w.resetsAt, now);
      if (normalized) windows.push(normalized);
    }
  }
  return { updatedAt: now, windows, error: windows.length ? null : "No subscription quota returned. Sign in to Codex with ChatGPT; API-key accounts may not expose it." };
}

export function normalizeClaude(payload, now = Date.now()) {
  const limits = payload?.rate_limits;
  const windows = [];
  for (const [key, label] of [["five_hour", "5h"], ["seven_day", "7d"]]) {
    const w = limits?.[key];
    const normalized = record(w) ? quotaWindow(label, w.used_percentage, w.resets_at, now) : null;
    if (normalized) windows.push(normalized);
  }
  return { updatedAt: now, windows, error: windows.length ? null : "Claude Code did not report subscription quotas in its status-line payload." };
}

export function normalizeGrok(payload, now = Date.now()) {
  const config = payload?.config;
  const period = config?.currentPeriod;
  const label = period?.type === "USAGE_PERIOD_TYPE_WEEKLY" ? "Weekly"
    : period?.type === "USAGE_PERIOD_TYPE_MONTHLY" ? "Monthly" : "Subscription";
  const reset = typeof period?.end === "string" ? Date.parse(period.end) / 1000 : null;
  const window = quotaWindow(label, config?.creditUsagePercent, reset, now);
  return { updatedAt: now, windows: window ? [window] : [],
    error: window ? null : "Grok did not report a subscription usage percentage. API-key accounts are not supported." };
}

export async function queryGrok({
  authFile = path.join(process.env.GROK_HOME || path.join(os.homedir(), ".grok"), "auth.json"),
  fetchImpl = fetch, timeoutMs = 10000,
} = {}) {
  const auth = await readJson(authFile, {});
  const key = Object.values(auth).find((entry) => record(entry) && typeof entry.key === "string" && entry.key.trim())?.key.trim();
  if (!key) throw new Error("Sign in with grok login before connecting Grok quotas.");
  try {
    const response = await fetchImpl("https://cli-chat-proxy.grok.com/v1/billing?format=credits", {
      headers: { Authorization: `Bearer ${key}`, "X-XAI-Token-Auth": "xai-grok-cli" },
      redirect: "error", signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Grok quota query failed. Check grok login and connectivity.");
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > MAX_INPUT) throw new Error("Grok quota response too large");
      chunks.push(Buffer.from(chunk));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    // Never echo response bodies or fetch errors: they may contain credentials.
    throw new Error("Cannot read Grok quotas. Check grok login and connectivity; the billing endpoint may have changed.");
  }
}

export function presentQuota(cached, enabled, now = Date.now()) {
  if (!enabled) return { enabled: false, status: "Disabled", windows: [] };
  if (!record(cached)) return { enabled: true, status: "Unavailable", windows: [], error: "Waiting for provider data." };
  const windows = Array.isArray(cached.windows) ? cached.windows.map((w) => ({ ...w, expired: w.resetsAt !== null && w.resetsAt <= now })) : [];
  const old = !Number.isFinite(cached.updatedAt) || now - cached.updatedAt > STALE_MS || cached.updatedAt > now;
  return { ...cached, windows, enabled: true,
    status: windows.length ? (cached.error || old || windows.some((w) => w.expired) ? "Stale" : "Current") : "Unavailable" };
}

async function readJson(file, fallback = null) {
  try {
    const raw = await fs.readFile(file, "utf8");
    if (Buffer.byteLength(raw) > MAX_INPUT) throw new Error("Quota file too large");
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new Error("Invalid quota JSON file"); }
    if (!record(parsed)) throw new Error("Invalid quota configuration");
    return parsed;
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(file).catch((e) => { if (e.code !== "ENOENT") throw e; });
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error("Refusing to replace a linked or non-regular configuration file");
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }); }
}

export function queryCodex(binary, { timeoutMs = 12000, spawnProcess = spawn } = {}) {
  return new Promise((resolve, reject) => {
    // No thread, prompt, login, or inference request is created.
    const child = spawnProcess(binary, ["app-server", "--listen", "stdio://"], { stdio: ["pipe", "pipe", "pipe"] });
    let buffer = "", bytes = 0, settled = false;
    const timer = setTimeout(() => finish(new Error("Codex quota query timed out")), timeoutMs);
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdin.destroy();
      child.kill();
      const kill = setTimeout(() => child.kill("SIGKILL"), 300);
      kill.unref();
      child.once("close", () => clearTimeout(kill));
      error ? reject(error) : resolve(value);
    };
    const send = (message) => child.stdin.write(`${JSON.stringify(message)}\n`);
    child.on("error", () => finish(new Error("Cannot run Codex. Check the configured executable.")));
    child.on("close", () => finish(new Error("Codex exited before returning quotas")));
    child.stdin.on("error", () => finish(new Error("Codex quota connection closed")));
    // Do not persist diagnostics, which may contain account information.
    child.stderr.resume();
    child.stdout.on("data", (data) => {
      bytes += data.length;
      if (bytes > MAX_INPUT) return finish(new Error("Codex quota response too large"));
      buffer += data.toString();
      let end;
      while (!settled && (end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        let message;
        try { message = JSON.parse(line); } catch { continue; }
        if (message.id !== 1 && message.id !== 2) continue;
        if (message.error) return finish(new Error(`Codex quota query failed (RPC ${Number.isInteger(message.error.code) ? message.error.code : "error"}). Check Codex sign-in and connectivity.`));
        if (message.id === 1) {
          send({ method: "initialized", params: {} });
          send({ id: 2, method: "account/rateLimits/read", params: {} });
        } else finish(null, message.result);
      }
    });
    send({ id: 1, method: "initialize", params: { clientInfo: { name: "herdr_insights", version: "0.1.0" }, capabilities: { explicitGatewayOauth: true } } });
  });
}

async function findCodex() {
  const dirs = [...(process.env.PATH || "").split(path.delimiter), path.join(os.homedir(), ".local/bin"),
    path.join(os.homedir(), ".local/share/mise/shims"), path.join(os.homedir(), ".local/share/mise/installs/codex/latest/bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  for (const dir of dirs.filter(Boolean)) {
    const file = path.resolve(dir, "codex");
    try { await fs.access(file, constants.X_OK); return file; } catch { /* next PATH entry */ }
  }
  throw new Error("Codex not found. Add it to PATH before enabling quotas.");
}

export async function configureClaude(store, enable, settingsFile = path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "settings.json")) {
  const configFile = path.join(store, "quota-settings.json");
  const config = await readJson(configFile, {});
  if (!enable && !config.claude?.enabled) return;
  // Refuse linked files rather than breaking a user's dotfile symlink.
  const stat = await fs.lstat(settingsFile).catch((e) => { if (e.code !== "ENOENT") throw e; });
  if (stat && (!stat.isFile() || stat.isSymbolicLink())) throw new Error("Claude settings are linked or not a regular file; configure the quota hook manually.");
  const original = stat ? await fs.readFile(settingsFile, "utf8") : null;
  let settings;
  try { settings = original === null ? {} : JSON.parse(original); } catch { throw new Error("Invalid Claude settings JSON; left unchanged."); }
  if (!record(settings)) throw new Error("Invalid Claude settings");
  if (enable && config.claude?.enabled) {
    if (settings.statusLine?.command !== config.claude.hook) throw new Error("Claude quota hook is no longer installed; settings left unchanged.");
    return;
  }
  const hook = `${quote(process.execPath)} ${quote(fileURLToPath(import.meta.url))} claude-statusline --store ${quote(store)}`;
  if (enable) {
    const previous = settings.statusLine;
    if (previous !== undefined && (!record(previous) || previous.type !== "command" || typeof previous.command !== "string")) throw new Error("Unsupported existing Claude status line; left unchanged.");
    config.claude = { enabled: true, settingsFile, previous: previous ?? null, hook };
    settings.statusLine = { ...previous, type: "command", command: hook };
  } else {
    if (settings.statusLine?.command !== config.claude.hook) throw new Error("Claude status line changed since connection; refusing to overwrite it.");
    if (config.claude.previous === null) delete settings.statusLine;
    else settings.statusLine = config.claude.previous;
    config.claude.enabled = false;
  }
  if (original !== null) await fs.writeFile(`${settingsFile}.insights-quota-${randomUUID()}.bak`, original, { flag: "wx", mode: 0o600 });
  const latest = await fs.readFile(settingsFile, "utf8").catch((e) => { if (e.code === "ENOENT") return null; throw e; });
  if (latest !== original) throw new Error("Claude settings changed during setup; try again.");
  // Save recovery information before switching the status-line command.
  await atomicJson(configFile, config);
  await atomicJson(settingsFile, settings);
}

async function stdinText() {
  let raw = "", size = 0;
  for await (const chunk of process.stdin) {
    size += chunk.length;
    if (size > MAX_INPUT) throw new Error("Status-line payload too large");
    raw += chunk;
  }
  return raw;
}

async function claudeStatusline(store) {
  const raw = await stdinText();
  const config = await readJson(path.join(store, "quota-settings.json"), {});
  if (config.claude?.enabled) {
    try { await atomicJson(path.join(store, "quota-claude.json"), normalizeClaude(JSON.parse(raw))); }
    catch { /* Do not break the existing status line if capture fails. */ }
  }
  const previous = config.claude?.previous?.command;
  if (typeof previous === "string") {
    await new Promise((resolve) => {
      const child = spawn("/bin/sh", ["-c", previous], { stdio: ["pipe", "inherit", "inherit"] });
      const timer = setTimeout(() => child.kill(), 5000);
      child.on("error", () => { clearTimeout(timer); resolve(); });
      child.on("close", () => { clearTimeout(timer); resolve(); });
      child.stdin.on("error", () => {});
      child.stdin.end(raw);
    });
  }
}

export async function quotaSnapshot(store, now = Date.now()) {
  const config = await readJson(path.join(store, "quota-settings.json"), {});
  const result = {};
  for (const provider of ["codex", "claude", "grok"]) {
    const cached = await readJson(path.join(store, `quota-${provider}.json`));
    result[provider] = presentQuota(cached, config[provider]?.enabled === true, now);
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const action = args.shift() || "read";
  if (args.length !== 2 || args[0] !== "--store" || !path.isAbsolute(args[1])) throw new Error("Usage: quotas.mjs <read|refresh|enable-codex|disable-codex|enable-claude|disable-claude|enable-grok|disable-grok|claude-statusline> --store /absolute/data/insights");
  const store = args[1];
  if (action === "claude-statusline") return claudeStatusline(store);
  if (!["read", "refresh", "enable-codex", "disable-codex", "enable-claude", "disable-claude", "enable-grok", "disable-grok"].includes(action)) throw new Error("Unknown quota action");
  await fs.mkdir(store, { recursive: true, mode: 0o700 });
  if (action.endsWith("claude")) {
    const config = await readJson(path.join(store, "quota-settings.json"), {});
    await configureClaude(store, action === "enable-claude", config.claude?.settingsFile);
  }
  if (action.endsWith("codex")) {
    const config = await readJson(path.join(store, "quota-settings.json"), {});
    config.codex = { enabled: action === "enable-codex", binary: action === "enable-codex" ? await findCodex() : config.codex?.binary };
    await atomicJson(path.join(store, "quota-settings.json"), config);
  }
  if (action === "refresh" || action === "enable-codex") {
    const config = await readJson(path.join(store, "quota-settings.json"), {});
    if (config.codex?.enabled) {
      const file = path.join(store, "quota-codex.json");
      let data;
      try { data = normalizeCodex(await queryCodex(config.codex.binary)); }
      catch (error) { data = { ...(await readJson(file, {})), error: error.message }; }
      await atomicJson(file, data);
    }
  }
  if (action.endsWith("grok")) {
    const config = await readJson(path.join(store, "quota-settings.json"), {});
    config.grok = { enabled: action === "enable-grok" };
    await atomicJson(path.join(store, "quota-settings.json"), config);
  }
  if (action === "refresh" || action === "enable-grok") {
    const config = await readJson(path.join(store, "quota-settings.json"), {});
    if (config.grok?.enabled) {
      const file = path.join(store, "quota-grok.json");
      let data;
      try { data = normalizeGrok(await queryGrok()); }
      catch (error) { data = { ...(await readJson(file, {})), error: error.message }; }
      await atomicJson(file, data);
    }
  }
  console.log(JSON.stringify(await quotaSnapshot(store)));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
