// Shared by the Codexing command hooks. Reads only `cwd` and `session_id` from the hook input, the
// workspace's package.json and git status, and Codexing's own files. Never the prompt, transcript or tool data.
import path from "node:path";
import { CAPABILITY_EVIDENCE, CODEXING_HOME, HOOKS_SEEN_FILE, SYNC_TYPES, readJson, writeJson } from "../server/config.mjs";
import { isLedgerloop } from "../server/workspace.mjs";

export { HOOKS_SEEN_FILE, writeJson };

// Remote installs (hosted Codexing) run the hooks with --remote: no local store, no credentials.
export const REMOTE = process.argv.includes("--remote");

const DAY = 86_400_000;

export function readInput(timeoutMs = 1000) {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve({});
    let raw = "";
    const done = () => {
      try {
        const input = JSON.parse(raw || "{}");
        resolve({ cwd: typeof input.cwd === "string" ? input.cwd : null, session_id: typeof input.session_id === "string" ? input.session_id : null });
      } catch {
        resolve({});
      }
    };
    const timer = setTimeout(() => {
      process.stdin.destroy();
      done();
    }, timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 4_000_000) raw = ""; // we only need two short fields
    });
    process.stdin.on("end", () => {
      clearTimeout(timer);
      done();
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      resolve({});
    });
  });
}

// ASCII-only JSON: on Windows, Codex runs hooks through PowerShell, which re-decodes a child's stdout
// with the console code page, so anything outside ASCII (₹, curly quotes) would arrive mangled.
export const asciiJson = (value) => JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

// Run main, print its JSON (if any) and exit 0 once stdout has drained (pipes can be async). Any failure is silent.
export async function run(main) {
  let text = "";
  try {
    const out = await main(await readInput());
    if (out) text = `${asciiJson(out)}\n`;
  } catch {
    // fail silent
  }
  process.stdout.write(text, () => process.exit(0));
}

const STATE_FILE = process.env.PLUGIN_DATA ? path.join(process.env.PLUGIN_DATA, "hook-state.json") : path.join(CODEXING_HOME, "hook-state.json");

export function readState() {
  const s = readJson(STATE_FILE, {}) || {};
  const cutoff = Date.now() - 14 * DAY;
  const sessions = Object.fromEntries(Object.entries(s.sessions || {}).filter(([, v]) => (v.seen_at || 0) > cutoff));
  return { sessions, tickets_nudged: Array.isArray(s.tickets_nudged) ? s.tickets_nudged.slice(-200) : [] };
}

export function saveState(state) {
  writeJson(STATE_FILE, state);
}

// Local demo: what the hooks need, derived from the store without seeding it if it doesn't exist yet.
export async function loadLocalStatus() {
  const reg = readJson(path.join(CODEXING_HOME, "registration.json"));
  const progress = readJson(path.join(CODEXING_HOME, "progress.json"));
  if (!reg || !progress) return { ticket: null };
  const { summary } = await import("../server/store.mjs");
  const view = summary({ registration: reg, progress });
  const current = progress.current_ticket != null && progress.tickets?.[progress.current_ticket]?.status !== "verified" ? view.current_ticket : null;
  const syncs = progress.events.filter((e) => SYNC_TYPES.has(e.type)).map((e) => Date.parse(e.at)).sort((a, b) => a - b);
  const evidence = {};
  for (const e of progress.events) if (e.ticket_id != null) (evidence[e.ticket_id] ||= []).push(e.type);
  return {
    ticket: current ? { id: current.id, title: current.title, tier: current.tier, capability: current.capability_to_try } : null,
    last_sync_at: syncs.at(-1) ?? null,
    streak_weeks: view.progress.streak_weeks,
    streak_status: view.progress.streak_status.startsWith("at risk") ? "at risk" : view.progress.streak_status,
    evidence,
  };
}

export function capabilityTried(status) {
  const t = status.ticket;
  const wanted = t ? CAPABILITY_EVIDENCE[t.tier] : null;
  if (!wanted) return null; // nothing we can observe for this tier
  const seen = new Set(status.evidence?.[t.id] || []);
  return wanted.some((type) => seen.has(type));
}

export function daysAgo(ms) {
  if (!ms) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / DAY));
}

export function workspaceOf(input) {
  const cwd = input.cwd || process.cwd();
  return isLedgerloop(cwd) ? cwd : null;
}
