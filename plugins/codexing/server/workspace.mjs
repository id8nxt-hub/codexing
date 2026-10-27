// LedgerLoop workspace helpers for the local demo and the hooks: recognise the sandbox, run its visible
// suite, and the local preflight checks. Only ever touches the workspace.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export function packageJson(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8"));
  } catch {
    return null;
  }
}

export function isLedgerloop(dir) {
  return Boolean(dir) && packageJson(dir)?.name === "ledgerloop";
}

export function resolveWorkspace(candidates) {
  for (const dir of candidates.filter(Boolean)) if (isLedgerloop(dir)) return path.resolve(dir);
  return null;
}

function git(ws, args, opts = {}) {
  return spawnSync("git", ["-C", ws, "-c", "core.quotepath=off", ...args], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
    timeout: 20_000,
    ...opts,
  });
}

export function tagExists(ws, tag) {
  if (!tag || !/^[\w.\-/]+$/.test(tag)) return false;
  return git(ws, ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}^{commit}`]).status === 0;
}

export function hasChanges(ws) {
  const r = git(ws, ["status", "--porcelain", "--untracked-files=normal", "--", "."]);
  return r.status === 0 && r.stdout.trim().length > 0;
}

function cleanEnv() {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // so the suite reports normally even when we run under node --test
  delete env.NODE_OPTIONS;
  return env;
}

// Runs the package's own test script. `node ...` scripts run with this Node binary; anything else via npm.
export function runVisibleSuite(ws, timeout = 20_000) {
  const script = packageJson(ws)?.scripts?.test;
  if (!script) return { ran: false, green: false, passed: 0, failed: 0, detail: "No test script in package.json." };
  const nodeScript = script.match(/^node\s+(.+)$/);
  const run = nodeScript
    ? spawnSync(process.execPath, nodeScript[1].split(/\s+/), { cwd: ws, encoding: "utf8", timeout, env: cleanEnv() })
    : spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["test", "--silent"], { cwd: ws, encoding: "utf8", timeout, shell: process.platform === "win32" });
  const out = `${run.stdout || ""}\n${run.stderr || ""}`;
  const count = (label) => {
    const m = out.match(new RegExp(`^[#ℹ]\\s*${label}\\s+(\\d+)`, "m"));
    return m ? Number(m[1]) : null;
  };
  const passed = count("pass") ?? 0;
  const failed = count("fail") ?? 0;
  const reported = count("tests") ?? passed + failed;
  const ran = run.error == null && (reported > 0 || run.status === 0);
  const green = ran && run.status === 0 && failed === 0;
  const detail = run.error
    ? `The suite did not finish (${run.error.code || run.error.message}).`
    : reported > 0
      ? `${passed} passed, ${failed} failing.`
      : `Test script exited with ${run.status}.`;
  return { ran, green, passed, failed, detail };
}

const LABELS = {
  app_signed_in: "Signed in to the Codex app",
  plugin_linked: "Codexing linked to your account",
  hooks_trusted: "Codexing hooks trusted",
  repo_open: "LedgerLoop open as the workspace",
  base_tag: "Ticket base tag present",
  deps_installed: "Dependencies installed",
  tests_run: "Visible test suite runs",
  usage_available: "Codex usage available",
  sites_entitled: "Sites available on your plan",
  computer_use_entitled: "Computer use available on your plan",
  os_permissions: "OS permissions for computer use",
};
export const PREFLIGHT_KEYS = Object.keys(LABELS);

// The checks the plugin can run itself; merged over whatever the skill reported.
export function localPreflight({ items = [], workspace, baseTag, linked, hooksSeenAt }) {
  const byKey = new Map();
  for (const it of items) {
    if (!it || !LABELS[it.key]) continue;
    byKey.set(it.key, { key: it.key, label: it.label || LABELS[it.key], ok: typeof it.ok === "boolean" ? it.ok : null, ...(it.detail ? { detail: String(it.detail).slice(0, 300) } : {}) });
  }
  const set = (key, ok, detail) => byKey.set(key, { key, label: LABELS[key], ok, ...(detail ? { detail } : {}) });

  if (linked !== undefined) set("plugin_linked", linked, linked ? undefined : "Paste the get-started prompt from your home page.");
  if (hooksSeenAt) set("hooks_trusted", true, `Hooks last ran ${hooksSeenAt}.`);
  else if (!byKey.has("hooks_trusted")) set("hooks_trusted", null, "Open /hooks in Codex and trust Codexing's hooks (optional, for nudges).");

  if (!workspace) {
    set("repo_open", false, "Open your LedgerLoop clone as the Codex workspace and pass its path.");
    for (const k of ["base_tag", "deps_installed", "tests_run"]) set(k, null, "Needs the LedgerLoop workspace.");
  } else {
    set("repo_open", true, workspace);
    const tag = baseTag || "t1-base";
    set("base_tag", tagExists(workspace, tag), tagExists(workspace, tag) ? tag : `${tag} not found: run \`git fetch --tags\`.`);
    const pkg = packageJson(workspace) || {};
    const needsDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length > 0;
    const hasModules = fs.existsSync(path.join(workspace, "node_modules"));
    set("deps_installed", !needsDeps || hasModules, !needsDeps ? "No dependencies to install." : hasModules ? undefined : "Run the install command from the LedgerLoop README.");
    const suite = runVisibleSuite(workspace);
    set("tests_run", suite.ran, suite.detail);
  }
  return PREFLIGHT_KEYS.filter((k) => byKey.has(k)).map((k) => byKey.get(k));
}
