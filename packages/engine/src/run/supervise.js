// Supervising a run's agent and the session that should start it: an agent that ends without returning is sent back
// once, then its run fails; a session that ends its turn with a run of its own items waiting is blocked with the exact
// Agent call, up to the stall budget, then the run fails; a session that cannot start a run says why, which fails it.
// Each limit is a kind of attempt in the run's budget (run/store.js BUDGET).
import { render, said } from '../messages.js';
import { returnLine } from '../stages.js';
import { sha256 } from '../names.js';
import { answerOf, BUDGET, boundRun, journal, loadRun, ownedRecords, spawnPrompt, spend, spent, state, transition } from './store.js';

// An agent ending with its run still open is sent back once to call the return tool;
// the next time it ends, its run fails, so the item gets the actor's error instead of waiting forever. An agent ends
// in two ways, and both are watched: the SubagentHandback tool (PreToolUse, handback()) and a plain stop (SubagentStop,
// stopped()). A block at SubagentStop does not re-prompt an agent that already handed back (a
// Claude Code behaviour), so such a stop fails the run at once.

// The bound agent's open run, or null when the agent is no actor or its run returned or failed.
function openRunOf(root, agentId) {
  const bound = boundRun(root, agentId);
  const run = bound && loadRun(root, bound.run);
  if (!run) return null;
  const now = state(root, run);
  if (now === 'returned' || now === 'failed') return null;
  return { run };
}

// Sends the run's agent back the first time it ends, spending the run's one send-back; true when it had already been
// sent back.
function sentBackBefore(root, run, agentId, how) {
  if (spent(root, run, 'sentBack') >= BUDGET.sentBack) return true;
  spend(root, run, 'sentBack');
  return !transition(root, run, 'send-back', { agentId, how, at: new Date().toISOString() });
}

// The send-back message is journalled word for word with its hash.
function sentBack(root, run, agentId, tool, { text, message }, session) {
  journal(root, run, {
    kind: 'refusal',
    source: { system: 'hook', ref: `stop ${agentId}` },
    agent: agentId,
    payload: { source: 'hook', rule: 'sent-back', reason: text, message, run: run.run, actor: run.actor, caller: agentId, tool, textHash: sha256(text), outcome: 'sent-back', hookSession: session }
  });
  return text;
}

function fail(root, { run }, agentId, how, session) {
  const { text: why, message } = said(how === 'SubagentStop, after a handback' ? 'no-return-after-handback' : 'no-return', { how });
  const failed = transition(root, run, 'fail', { agentId, why, at: new Date().toISOString() }, {
    kind: 'refusal',
    source: { system: 'hook', ref: `stop ${agentId}` },
    agent: agentId,
    payload: { source: 'hook', rule: 'no-return', reason: why, message, run: run.run, actor: run.actor, caller: agentId, tool: how.startsWith('SubagentStop') ? 'SubagentStop' : 'SubagentHandback', textHash: sha256(`no-return: ${why}`), outcome: 'denied', hookSession: session }
  });
  return failed ? { failed: run.run } : null;
}

/**
 * PreToolUse of SubagentHandback by an agent: null (no actor, or its result is in), { deny: reason } the first time
 * its run is open, or { failed: run } the next time; the handback then goes through.
 */
export function handback({ root, agentId, session = null }) {
  const open = openRunOf(root, agentId);
  if (!open) return null;
  if (!sentBackBefore(root, open.run, agentId, 'SubagentHandback')) {
    return { deny: sentBack(root, open.run, agentId, 'SubagentHandback', said('sent-back-handback', { returnLine: returnLine(open.run.run) }), session) };
  }
  return fail(root, open, agentId, 'SubagentHandback', session);
}

/**
 * SubagentStop of an agent: null (no actor, or its run returned or failed), { block: reason } the first time its run
 * is open, or { failed: run }. `again` is the hook input's stop_hook_active; `handedBack` is true when the agent's
 * transcript ends in its SubagentHandback result, when a block would not bring it back.
 */
export function stopped({ root, agentId, again = false, handedBack = false, session = null }) {
  const open = openRunOf(root, agentId);
  if (!open) return null;
  if (handedBack) return fail(root, open, agentId, 'SubagentStop, after a handback', session);
  if (!again && !sentBackBefore(root, open.run, agentId, 'SubagentStop')) return { block: sentBack(root, open.run, agentId, 'SubagentStop', said('return-line', { run: open.run.run }), session) };
  return fail(root, open, agentId, 'SubagentStop', session);
}

// ---- The stall guard
//
// A Stop of the session that owns an item, with one of the item's runs prepared and no agent, is blocked with the
// exact Agent call to make. Claude Code's stop_hook_active only marks a stop that follows a block, so the guard keeps
// its own count: the stall rows for the run in the item's file. STALL_CAP blocks per run; the stop after that fails
// the run, so the item takes the invoke's error (in quick-fix, replanning, where a card is in front of the person).
// A session that cannot start a run says why with the Agent prompt `ccp-cannot-start <run>: <why>`, which fails it.
// plan/decisions/2026-11-05-waiting-run-stall.md.

export const STALL_CAP = BUDGET.stalled;
export const CANNOT_START = /^\s*ccp-cannot-start\s+(\S+:\d+\.[\w-]+):\s*(\S[\s\S]*?)\s*$/;
export const cannotStartPrompt = (run, why = '<why>') => `ccp-cannot-start ${run}: ${why}`;

const stateOf = (run) => {
  try {
    return JSON.stringify(JSON.parse(run.state));
  } catch {
    return String(run.state);
  }
};

// Fails a run that has no agent: failed.json, then a refusal row with the rule. False when it had already failed.
function failUnstarted(root, run, rule, { text: why, message }, tool, session) {
  return transition(root, run, 'fail', { agentId: null, why, at: new Date().toISOString() }, {
    kind: 'refusal',
    source: { system: 'hook', ref: `${tool} ${run.run}` },
    payload: { source: 'hook', rule, reason: why, message, run: run.run, actor: run.actor, caller: null, tool, textHash: sha256(`${rule}: ${why}`), outcome: 'failed', hookSession: session }
  });
}

/** The block reason for a waiting run: what is waiting, the exact call, which block this is, and the way out. */
export const stallText = (run, count) => stallSaid(run, count).text;
const stallSaid = (run, count) => said('stall', {
  item: String(run.item), state: stateOf(run), run: String(run.run), actor: String(run.actor),
  prompt: spawnPrompt(run.run), cannotStart: cannotStartPrompt(run.run), count, cap: STALL_CAP
});

/**
 * A Stop of the main session. `sessions` are the names the session may own items under (its session_id and its
 * sessionName). Null with no run of its own waiting; else { block, failed }: runs already blocked STALL_CAP times
 * fail now (failed), and the first run blocked fewer times is blocked (block, its reason; null when none is left).
 */
export function stall({ root, sessions, session = null }) {
  const runs = ownedRecords(root, sessions);
  if (!runs.length) return null;
  const failed = [];
  let block = null;
  for (const run of runs) {
    const count = spent(root, run, 'stalled');
    if (count >= STALL_CAP) {
      const why = said('stall-cap', { turns: STALL_CAP + 1, run: String(run.run), cap: STALL_CAP });
      if (failUnstarted(root, run, 'stall-cap', why, 'Stop', session)) failed.push(run.run);
      continue;
    }
    if (block) continue;
    spend(root, run, 'stalled');
    const told = stallSaid(run, count + 1);
    block = told.text;
    journal(root, run, {
      kind: 'refusal',
      source: { system: 'hook', ref: `Stop ${run.run}` },
      payload: { source: 'hook', rule: 'stall', reason: block, message: told.message, count: count + 1, cap: STALL_CAP, run: run.run, actor: run.actor, caller: null, tool: 'Stop', textHash: sha256(block), outcome: 'blocked', hookSession: session }
    });
  }
  return { block, failed };
}

/**
 * PreToolUse of the Agent tool with the prompt `ccp-cannot-start <run>: <why>`. Null for any other prompt; else
 * { deny } (the call never starts an agent), with failed: the run when it was failed now. Only a session the run's
 * item is owned by may fail it.
 */
export function cannotStart({ root, prompt, sessions, session = null }) {
  if (!/^\s*ccp-cannot-start\b/.test(String(prompt ?? ''))) return null;
  const m = String(prompt).match(CANNOT_START);
  if (!m || m[2] === '<why>') return { deny: render('cannot-start-no-reason', { prompt: cannotStartPrompt('<run>') }) };
  const [, id, why] = m;
  const run = loadRun(root, id);
  if (!run) return { deny: render('unknown-run', { run: id }) };
  if (!sessions.filter(Boolean).includes(run.session)) return { deny: render('cannot-start-wrong-session', { run: run.run, owner: String(run.session) }) };
  const answer = answerOf('cannot-start', state(root, run));
  if (answer) return { deny: render(answer, { run: run.run }) };
  if (!failUnstarted(root, run, 'cannot-start', said('cannot-start-reason', { why }), 'Agent', session)) return { deny: render('cannot-start-already-failed', { run: run.run }) };
  return { deny: render('cannot-start-done', { run: run.run }), failed: run.run };
}
