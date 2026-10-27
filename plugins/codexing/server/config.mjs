// Codexing's own local files (the demo store, hook state) and shared constants.
// Everything lives under CODEXING_HOME (default ~/.codexing). Nothing here reads any other file.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const PLUGIN_VERSION = "0.2.0";
export const CODEXING_HOME = process.env.CODEXING_HOME || path.join(os.homedir(), ".codexing");
export const HOOKS_SEEN_FILE = path.join(CODEXING_HOME, "hooks-seen.json");

export const PLANS = ["free", "go", "plus", "pro", "business", "enterprise", "edu", "unknown"];
export const PLAN_SOURCES = ["codex_reported", "participant_stated"];
export const EVENT_TYPES = ["site_deployed", "computer_use_run", "skill_used", "worktrees_used", "goal_run", "exit_answer"];

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  renameRetry(tmp, file);
}

// Windows: an antivirus scan or the search indexer can hold the target for a moment, and rename then fails
// with EPERM/EACCES/EBUSY. Retry briefly; give up (and drop the temp file) after about a second.
const TRANSIENT = new Set(["EPERM", "EACCES", "EBUSY"]);
export function renameRetry(from, to, tries = 10) {
  for (let i = 1; ; i++) {
    try {
      return fs.renameSync(from, to);
    } catch (err) {
      if (i >= tries || !TRANSIENT.has(err.code)) {
        fs.rmSync(from, { force: true });
        throw err;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20 * i);
    }
  }
}

// Ledger entry types that count as a sync (contracts README: Events).
export const SYNC_TYPES = new Set(["checkin", "plan_approved", "tests_run", "stuck", "submitted", "checks_failed", "verified"]);

// Evidence that a ticket's capability was tried, by tier. Tiers without an entry are never nudged.
export const CAPABILITY_EVIDENCE = {
  1: ["plan_approved"],
  2: ["skill_used"],
  3: ["worktrees_used", "goal_run"],
};
