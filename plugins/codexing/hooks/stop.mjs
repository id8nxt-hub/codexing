// Stop: at most one "check my work" nudge per session, and (local demo only) at most one nudge per ticket
// when its capability hasn't been tried. Acts only in the LedgerLoop workspace; silent elsewhere and on errors.
//
// Local demo: needs an assigned ticket, a green visible suite and nothing synced for 20 minutes (from the store).
// Remote (--remote, hosted Codexing): the hook has no credentials, so it can't see tickets or syncs. It nudges
// once per session when the suite is green and the workspace has had uncommitted changes for 20 minutes.
import { hasChanges, runVisibleSuite } from "../server/workspace.mjs";
import { REMOTE, capabilityTried, loadLocalStatus, readState, run, saveState, workspaceOf } from "./lib.mjs";

const QUIET_MS = 20 * 60_000;
const RETEST_MS = 5 * 60_000; // don't rerun the suite more often than this in one session
const PREFIX = "[Codexing nudge from a hook, not typed by the developer]";

const greenNudge = (what) => ({
  decision: "block",
  reason: `${PREFIX} The visible suite is green ${what}. Reply with just this one line in Codexing's voice: "That looks green. Want me to check your work?" Don't run or change anything until they answer.`,
});

run(async (input) => {
  const ws = workspaceOf(input);
  if (!ws) return null;
  const now = Date.now();
  const state = readState();
  const sid = input.session_id || "unknown";
  const session = (state.sessions[sid] ||= {});
  session.seen_at = now;

  let changed = null;
  const changes = () => (changed ??= hasChanges(ws));
  const retestDue = () => !session.last_test_at || now - session.last_test_at >= RETEST_MS;
  const greenNow = () => {
    session.last_test_at = now;
    saveState(state);
    return runVisibleSuite(ws, 20_000).green;
  };

  if (REMOTE) {
    if (session.green_nudged || !changes()) {
      if (!changed) delete session.changes_since;
      saveState(state);
      return null;
    }
    session.changes_since ||= now;
    if (now - session.changes_since >= QUIET_MS && retestDue() && greenNow()) {
      session.green_nudged = now;
      saveState(state);
      return greenNudge("and these changes have been sitting for 20 minutes");
    }
    saveState(state);
    return null;
  }

  const status = await loadLocalStatus();
  if (!status.ticket) return null;
  const ticket = status.ticket;
  const quiet = !status.last_sync_at || now - status.last_sync_at >= QUIET_MS;
  if (!session.green_nudged && quiet && retestDue() && changes() && greenNow()) {
    session.green_nudged = now;
    saveState(state);
    return greenNudge(`on ticket #${ticket.id} and nothing has synced for 20 minutes`);
  }

  if (capabilityTried(status) === false && !state.tickets_nudged.includes(ticket.id) && changes()) {
    state.tickets_nudged.push(ticket.id);
    saveState(state);
    return {
      decision: "block",
      reason: `${PREFIX} Ticket #${ticket.id} is there to show "${ticket.capability}", and that hasn't been tried on it yet. In one short line, suggest they try it for the next step. Don't run or change anything else.`,
    };
  }

  saveState(state);
  return null;
});
