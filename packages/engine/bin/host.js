#!/usr/bin/env node
// The host from the command line, one item per call (plan item engine-host). See packages/engine/README.md.
//
//   host.js start --item <id> --workflow <name> --input <json> --session <id> [--root <dir>] [--release x.y.z]
//   host.js wake  --item <id> --workflow <name> [--root <dir>] [--release x.y.z]   < hook input JSON
//   host.js show  --item <id> --workflow <name> [--root <dir>]
//   host.js card  --item <id> --workflow <name> --effect <ask run id> --ref <card id> [--root <dir>]
//   host.js closed --item <id> --workflow <name> --effect <ask run id> [--root <dir>]
//   host.js answer --item <id> --workflow <name> --effect <ask run id> --choice <c> --by <session> [--why <text>] [--grants <file>]
//   start and wake also take [--repo <git clone>] [--worktrees <dir>] for the actors' worktrees.
//
// wake reads a Claude Code hook's input on stdin: UserPromptSubmit (the wake is its prompt) or PostToolUse of
// ReadNotifications, where only notifications GitHub's webhook delivered and fired reminders (origin trigger_fire, read
// as a bare wake at the time they fired; fix-reminder-wake) are read. Any other tool's output is
// ignored, whatever it contains. The session is the hook input's session_id. Nothing on the command line can name an
// event or its source: those come only from the wake text. What this cannot stop: an agent with a shell can run this
// command with stdin it typed, as it can append rows by hand (ledger L-same-account-everywhere); the decision says so.
// Effects run with the handlers in src/effects (plan item engine-effects): merges, over GitHub REST. A command has no
// way into the thread and no clock to wake it, so posts stay pending and are printed. A timer effect ends at once with
// its due time, and the open timer stays listed under pending.timers: its due time is there for the session to
// schedule its wake (send_later), and any wake past it fires the timer (plan item fix-waiting-wake). A card waits until the session that can post it has put it up and run
// `card` with its id (src/effects/relay.js, plan item engine-toy-run); `card` then finishes the card effect as the
// item's owner, so the item's file names the card from then on (plan item engine-item-views), and a tap on it is
// matched to its run. When the item leaves the state that asked, the ask run's stop is listed under pending; the
// session withdraws the card (close_decision) and runs `closed`, which finishes the stop as the owner (plan item
// fix-finish-closes-waits). An agent actor's run (brief, build, verify; plan item
// engine-actors) is prepared here: its brief, folder and worktree (added from --repo, default the current folder,
// under --worktrees). `waiting` lists the runs whose agent the session starts next, with the Agent prompt to use.
// CCP_GITHUB_API points GitHub calls at another server (tests), as it does for the actor hook.
// Every call also offers the results the harness's return hook accepted and has not yet handed to the item.
// answer is a stand-in's answer to an open ask whose card is up (src/standin.js, plan item engine-cards-standin): taken
// only if it is one of the ask's choices and an entry in the grants file (default <root>/../grants.json) covers it.
// It is applied as the item's owner, like a tap the owner's hook reads, so the host runs what follows itself.
// A card with no PR is checked against the item's GitHub issue's repo, and --why goes with the answer (fix-blocked-card-grant).
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadWorkflow, workflowOf } from '../src/index.js';
import { restore, offer, pending } from '../src/host.js';
import { inputsOfWake } from '../src/wake.js';
import { github, handlers, recordCard, recordClosed, relay } from '../src/effects/index.js';
import { actors, resultsOf, waiting } from '../src/actors.js';
import { tripwiresOf } from '../src/tripwire.js';
import { grantsFileFor, readGrants, standinInput } from '../src/standin.js';

const { positionals: [command], values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    item: { type: 'string' },
    workflow: { type: 'string' },
    input: { type: 'string' },
    session: { type: 'string' },
    root: { type: 'string', default: process.env.CCP_JOURNAL_DIR ?? '/mnt/project-files/harness/journal' },
    release: { type: 'string' },
    repo: { type: 'string' },
    worktrees: { type: 'string' },
    effect: { type: 'string' },
    ref: { type: 'string' },
    choice: { type: 'string' },
    by: { type: 'string' },
    grants: { type: 'string' },
    why: { type: 'string' }
  }
});

const manifestRelease = () =>
  JSON.parse(readFileSync(new URL('../../../plugins/harness/.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;

// The wake text a hook input carries: a UserPromptSubmit's prompt, or from a ReadNotifications result the bodies of
// the GitHub notifications and, for each scheduled trigger that fired (a send_later reminder, origin trigger_fire), a
// wake with no body at the time it fired. A reminder's content is never read: the session or any agent wrote it, and
// a bare wake can only fire timers already due by the host's clock (plan item fix-reminder-wake). Nothing else.
const wakeTextOf = (hook) => {
  if (hook.hook_event_name === 'UserPromptSubmit') return typeof hook.prompt === 'string' ? hook.prompt : '';
  if (hook.hook_event_name !== 'PostToolUse' || hook.tool_name !== 'ReadNotifications') return '';
  const notifications = hook.tool_response?.notifications;
  if (!Array.isArray(notifications)) return '';
  return notifications
    .map((n) => {
      if (n?.origin === 'github_webhook' && typeof n.content === 'string') return n.content;
      if (n?.origin === 'trigger_fire') return reminderWake(n);
      return null;
    })
    .filter((text) => text !== null)
    .join('\n');
};

// A fired reminder as a wake: reason scheduled, current-time the time it fired (queued_at, else arrived_at), no body.
const reminderWake = (n) => {
  const fired = [n.queued_at, n.arrived_at].find((t) => typeof t === 'string' && !Number.isNaN(Date.parse(t)));
  return fired ? `<wake reason="scheduled" current-time="${new Date(Date.parse(fired)).toISOString()}"></wake>` : null;
};

const fail = (message) => {
  console.error(`host: ${message}`);
  process.exit(2);
};

if (!['start', 'wake', 'show', 'card', 'closed', 'answer'].includes(command)) fail('the command is start, wake, show, card, closed or answer');
if (!opts.item || !opts.workflow) fail('--item and --workflow are required');
const spec = workflowOf(opts.root, opts.item) ?? loadWorkflow(opts.workflow, { root: opts.root });
const release = opts.release ?? process.env.CCP_HARNESS_RELEASE ?? manifestRelease();

let session = opts.session;
let inputs = [];
if (command === 'wake') {
  const hook = JSON.parse(readFileSync(0, 'utf8'));
  session = hook.session_id;
  const text = wakeTextOf(hook);
  inputs = (host) => inputsOfWake(host, text);
}
if (!session && !['show', 'card', 'closed', 'answer'].includes(command)) fail('no session: start takes --session, wake reads session_id from the hook input');

// A refusal from the journal (an older writer, say) is printed as one line, not a stack.
process.on('uncaughtException', (error) => fail(error.message));
process.on('unhandledRejection', (error) => fail(error?.message ?? String(error)));
let host = restore({ root: opts.root, item: opts.item, spec, session: session ?? command, release });
if (command === 'answer') {
  // Applied as the item's owner: the answer is the run's completion, as a tap read by the owner's hook would be.
  if (!host.owner) fail(`${opts.item} has not started`);
  host = restore({ root: opts.root, item: opts.item, spec, session: host.owner, release });
  const grants = readGrants(opts.grants ?? grantsFileFor(opts.root));
  // Read after the open effects run, so a card recorded since the last call is up before the answer is checked.
  inputs = (h) => [standinInput(h, { effect: opts.effect, choice: opts.choice, by: opts.by, why: opts.why, grants })];
}
let card = null;
if (command === 'card') {
  // A record of which card was put up; the card effect then finishes with it now, as the owner, so the item's file
  // holds the card's id from the moment it is up (the item view joins the card's rows by it: engine-item-views).
  card = recordCard({ host, effect: opts.effect, ref: opts.ref });
  if (host.owner) host = restore({ root: opts.root, item: opts.item, spec, session: host.owner, release });
}
if (command === 'closed') {
  // The card was withdrawn in the thread; the stop effect then finishes with it now, as the owner.
  card = recordClosed({ host, effect: opts.effect });
  if (host.owner) host = restore({ root: opts.root, item: opts.item, spec, session: host.owner, release });
}
if (command === 'start') {
  if (!opts.input) fail('start needs --input');
  inputs = [{ event: { type: 'xstate.init', input: JSON.parse(opts.input) }, source: { system: 'claude-code', ref: session } }];
}
const agents = actors({ host, repo: opts.repo ?? process.cwd(), ...(opts.worktrees ? { worktrees: opts.worktrees } : {}) });
const all = handlers({ github: github(process.env.CCP_GITHUB_API ? { api: process.env.CCP_GITHUB_API } : {}), hearth: relay({ root: opts.root }), actors: agents });
// timer and cancel have no clock here: a timer ends with its due time, still listed under pending.timers for the
// session to schedule its wake, and a cancel ends at once (plan item fix-waiting-wake).
const effects = { run: all.run, stop: all.stop, timer: all.timer, cancel: all.cancel };
// Effects left open (a card now put up) run first, so the wake's inputs are read against the item as they leave it.
const before = command === 'show' ? [] : await offer(host, [], effects);
const offered = typeof inputs === 'function' ? inputs(host) : inputs;
const results = command === 'show' ? [] : [...before, ...(await offer(host, [...offered, ...(host.snapshot ? [...resultsOf(host), ...tripwiresOf(host)] : [])], effects))];
if (card) {
  console.log(JSON.stringify(card, null, 2));
  process.exit(0);
}
console.log(JSON.stringify({
  item: opts.item,
  owner: host.owner,
  state: host.snapshot?.value ?? null,
  results: results.map(({ outcome, row }) => ({ outcome, reason: row.payload.reason, event: row.payload.event?.type, source: row.source })),
  pending: pending(host),
  waiting: waiting(opts.root, opts.item)
}, null, 2));
