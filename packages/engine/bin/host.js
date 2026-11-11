#!/usr/bin/env node
// The host from the command line, one item and its child items per call. See packages/engine/README.md.
//
//   host.js start --item <id> --workflow <name> --input <json> --session <id> [--selected-by <who> [--how <text>]] [--root <dir>] [--release x.y.z]
//   host.js wake  --item <id> --workflow <name> [--root <dir>] [--release x.y.z]   < hook input JSON
//   host.js show  --item <id> --workflow <name> [--root <dir>]
//   host.js card  --item <id> --workflow <name> --effect <ask run id> --ref <card id> [--root <dir>]
//   host.js closed --item <id> --workflow <name> --effect <ask run id> [--root <dir>]
//   host.js answer --item <id> --workflow <name> --effect <ask run id> --choice <c> --by <session> [--why <text>] [--grants <file>]
//   start and wake also take [--repo <git clone>] [--worktrees <dir>] for the actors' worktrees.
//
// --item names the top item. An invoke whose actor is a workflow starts a child item, and every command drives the
// whole tree: each open item is offered the call's inputs, and a child's end reaches its parent in the same call.
// card, closed and answer take a child's ask run in --effect. start's --selected-by and --how say who picked the
// workflow and how; its row records them with the pinned workflow id.
//
// wake reads a Claude Code hook's input on stdin: UserPromptSubmit (the wake is its prompt) or PostToolUse of
// ReadNotifications, where only notifications GitHub's webhook delivered and fired reminders (origin trigger_fire, read
// as a bare wake at the time they fired) are read. Any other tool's output is
// ignored, whatever it contains. The session is the hook input's session_id. Nothing on the command line can name an
// event or its source: those come only from the wake text. What this cannot stop: an agent with a shell can run this
// command with stdin it typed, as it can append rows by hand (ledger L-same-account-everywhere); the decision says so.
// Effects run with the handlers in src/effects: merges, over GitHub REST. A command has no way into the thread and no
// clock to wake it, so posts stay pending and are printed. A timer effect ends at once with its due time, and the open
// timer stays listed under pending.timers: its due time is there for the session to schedule its wake (send_later),
// and any wake past it fires the timer. A card waits until the session that can post it has put it up and run `card`
// with its id (src/effects/relay.js); `card` then finishes the card effect as the item's owner, so the item's file
// names the card from then on, and a tap on it is matched to its run. When the item leaves the state that asked, the
// ask run's stop is listed under pending; the session withdraws the card (close_decision) and runs `closed`, which
// finishes the stop as the owner. An agent actor's run (brief, build, verify; src/actors.js) is prepared here: its brief, folder and worktree (added from --repo, default the current folder,
// under --worktrees). `waiting` lists the runs whose agent the session starts next, with the Agent prompt to use.
// CCP_GITHUB_API points GitHub calls at another server (tests), as it does for the actor hook.
// Every call also offers the results the harness's return hook accepted and has not yet handed to the item.
// answer is a stand-in's answer to an open ask whose card is up (src/standin.js): taken
// only if it is one of the ask's choices and an entry in the grants file (default <root>/../grants.json) covers it.
// It is applied as the item's owner, like a tap the owner's hook reads, so the host runs what follows itself.
// A card with no PR is checked against the item's GitHub issue's repo, and --why goes with the answer.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadWorkflow, workflowOf } from '../src/index.js';
import { restore, offer, pending } from '../src/host.js';
import { inputsOfWake } from '../src/wake.js';
import { github, handlers, recordCard, recordClosed, relay, pump, openItems } from '../src/effects/index.js';
import { actors, waiting } from '../src/actors.js';
import { runOf } from '../src/names.js';
import { isStage, EFFECTS } from '../src/stages.js';
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
    why: { type: 'string' },
    'selected-by': { type: 'string' },
    how: { type: 'string' }
  }
});

const manifestRelease = () =>
  JSON.parse(readFileSync(new URL('../../../plugins/harness/.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;

// The wake text a hook input carries: a UserPromptSubmit's prompt, or from a ReadNotifications result the bodies of
// the GitHub notifications and, for each scheduled trigger that fired (a send_later reminder, origin trigger_fire), a
// wake with no body at the time it fired. A reminder's content is never read: the session or any agent wrote it, and
// a bare wake can only fire timers already due by the host's clock. Nothing else.
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
let inputs = () => [];
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

// The item tree: the item named, and the child items its open runs started, each on its own pinned workflow. An
// --effect names its run's item, which is the item named or one of its children.
const top = opts.item;
const target = opts.effect ? (runOf(opts.effect)?.item ?? top) : top;
if (target !== top && !openItems(opts.root, top).includes(target)) fail(`${opts.effect} is not a run of ${top} or of an open child item of it`);
const restoreAs = (item, as) => {
  const pinned = item === top ? spec : workflowOf(opts.root, item);
  if (!pinned) fail(`${item} has not started`);
  return restore({ root: opts.root, item, spec: pinned, session: as, release });
};
let host = restoreAs(target, session ?? command);
const owner = host.owner;
if (command === 'answer') {
  // Applied as the item's owner: the answer is the run's completion, as a tap read by the owner's hook would be.
  if (!owner) fail(`${target} has not started`);
  host = restoreAs(target, owner);
  const grants = readGrants(opts.grants ?? grantsFileFor(opts.root));
  // Read after the open effects run, so a card recorded since the last call is up before the answer is checked.
  const answer = (h) => [standinInput(h, { effect: opts.effect, choice: opts.choice, by: opts.by, why: opts.why, grants })];
  inputs = (h) => (h.item === target ? answer(h) : []);
}
let card = null;
if (command === 'card') {
  // A record of which card was put up; the card effect then finishes with it now, as the owner, so the item's file
  // holds the card's id from the moment it is up (the item view joins the card's rows by it).
  card = recordCard({ host, effect: opts.effect, ref: opts.ref });
}
if (command === 'closed') {
  // The card was withdrawn in the thread; the stop effect then finishes with it now, as the owner.
  card = recordClosed({ host, effect: opts.effect });
}
// card, closed and answer act as the owner of the tree, as the owner's hook would; start and wake as the session.
const as = ['card', 'closed', 'answer'].includes(command) ? (owner ?? session ?? command) : session;

// Each item's handlers: its agents' runs prepared in worktrees, its workflow actors started as child items, merges
// over GitHub REST, cards and posts through the relay.
const gh = github(process.env.CCP_GITHUB_API ? { api: process.env.CCP_GITHUB_API } : {});
const workflowsOf = (h) => Object.keys(h.spec.meta?.actors ?? {}).filter((name) => !isStage(h.spec.meta.actors[name]) && !EFFECTS.includes(name));
const handlersFor = (h) => {
  const all = handlers({
    github: gh,
    hearth: relay({ root: opts.root }),
    actors: actors({ host: h, repo: opts.repo ?? process.cwd(), ...(opts.worktrees ? { worktrees: opts.worktrees } : {}) }),
    host: h,
    workflows: workflowsOf(h),
    load: loadWorkflow,
    handlersFor
  });
  // timer and cancel have no clock here: a timer ends with its due time, still listed under pending.timers for the
  // session to schedule its wake, and a cancel ends at once.
  return { run: all.run, stop: all.stop, timer: all.timer, cancel: all.cancel };
};

const results = [];
if (command === 'start') {
  if (!opts.input) fail('start needs --input');
  const selection = opts['selected-by'] ? { by: opts['selected-by'], how: opts.how ?? null } : null;
  if (!selection && opts.how) fail('--how goes with --selected-by');
  const started = restoreAs(top, session);
  for (const r of await offer(started, [{ event: { type: 'xstate.init', input: JSON.parse(opts.input) }, source: { system: 'claude-code', ref: session }, ...(selection ? { selection } : {}) }], handlersFor(started))) {
    results.push({ item: top, ...r });
  }
}
// Every command but show then offers, to the item and each open child item, the wake's inputs (or the answer), the
// results the return hook accepted, tripwire rows and finished children, until nothing more applies. Effects left open
// (a card now put up) run first, so the inputs are read against each item as they leave it.
if (command !== 'show' && (command !== 'start' || results.some((r) => r.outcome === 'applied'))) {
  results.push(...(await pump({
    root: opts.root, top, session: as, release, handlersFor,
    inputsFor: (h) => [...inputs(h), ...(h.snapshot ? tripwiresOf(h) : [])]
  })));
}
if (card) {
  console.log(JSON.stringify(card, null, 2));
  process.exit(0);
}
const tree = openItems(opts.root, top).map((item) => restoreAs(item, as ?? command));
const topHost = tree[0] ?? restoreAs(top, as ?? command);
console.log(JSON.stringify({
  item: top,
  owner: topHost.owner,
  state: topHost.snapshot?.value ?? null,
  results: results.map(({ item, outcome, row }) => ({ ...(item !== top ? { item } : {}), outcome, reason: row.payload.reason, event: row.payload.event?.type, source: row.source })),
  pending: pending(topHost),
  children: tree.slice(1).map((h) => ({ item: h.item, workflow: h.spec.id, state: h.snapshot?.value ?? null, pending: pending(h) })),
  waiting: tree.flatMap((h) => waiting(opts.root, h.item).map((w) => ({ ...w, ...(h.item !== top ? { item: h.item } : {}) })))
}, null, 2));
