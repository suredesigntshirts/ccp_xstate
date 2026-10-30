#!/usr/bin/env node
// The host from the command line, one item per call (plan item engine-host). See packages/engine/README.md.
//
//   host.js start --item <id> --workflow <name> --input <json> --session <id> [--root <dir>] [--release x.y.z]
//   host.js wake  --item <id> --workflow <name> [--root <dir>] [--release x.y.z]   < hook input JSON
//   host.js show  --item <id> --workflow <name> [--root <dir>]
//
// wake reads a Claude Code hook's input on stdin: UserPromptSubmit (the wake is its prompt) or PostToolUse of
// ReadNotifications, where only notifications GitHub's webhook delivered are read. Any other tool's output is
// ignored, whatever it contains. The session is the hook input's session_id. Nothing on the command line can name an
// event or its source: those come only from the wake text. What this cannot stop: an agent with a shell can run this
// command with stdin it typed, as it can append rows by hand (ledger L-same-account-everywhere); the decision says so.
// Effects run with the handlers in src/effects (plan item engine-effects): merges, over GitHub REST. A command has no
// way into the thread and no clock to wake it, so cards, posts and timers, and the agents engine-actors starts, stay
// pending and are printed; a timer's due time is there for the session to schedule its wake.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadWorkflow } from '../src/index.js';
import { restore, offer, pending } from '../src/host.js';
import { inputsOfWake } from '../src/wake.js';
import { github, handlers } from '../src/effects/index.js';

const { positionals: [command], values: opts } = parseArgs({
  allowPositionals: true,
  options: {
    item: { type: 'string' },
    workflow: { type: 'string' },
    input: { type: 'string' },
    session: { type: 'string' },
    root: { type: 'string', default: process.env.CCP_JOURNAL_DIR ?? '/mnt/project-files/harness/journal' },
    release: { type: 'string' }
  }
});

const manifestRelease = () =>
  JSON.parse(readFileSync(new URL('../../../plugins/harness/.claude-plugin/plugin.json', import.meta.url), 'utf8')).version;

// The wake text a hook input carries: a UserPromptSubmit's prompt, or the bodies of the GitHub notifications in a
// ReadNotifications result. Nothing else.
const wakeTextOf = (hook) => {
  if (hook.hook_event_name === 'UserPromptSubmit') return typeof hook.prompt === 'string' ? hook.prompt : '';
  if (hook.hook_event_name !== 'PostToolUse' || hook.tool_name !== 'ReadNotifications') return '';
  const notifications = hook.tool_response?.notifications;
  if (!Array.isArray(notifications)) return '';
  return notifications
    .filter((n) => n?.origin === 'github_webhook' && typeof n.content === 'string')
    .map((n) => n.content)
    .join('\n');
};

const fail = (message) => {
  console.error(`host: ${message}`);
  process.exit(2);
};

if (!['start', 'wake', 'show'].includes(command)) fail('the command is start, wake or show');
if (!opts.item || !opts.workflow) fail('--item and --workflow are required');
const spec = loadWorkflow(opts.workflow);
const release = opts.release ?? process.env.CCP_HARNESS_RELEASE ?? manifestRelease();

let session = opts.session;
let inputs = [];
if (command === 'wake') {
  const hook = JSON.parse(readFileSync(0, 'utf8'));
  session = hook.session_id;
  const text = wakeTextOf(hook);
  inputs = (host) => inputsOfWake(host, text);
}
if (!session && command !== 'show') fail('no session: start takes --session, wake reads session_id from the hook input');

// A refusal from the journal (an older writer, say) is printed as one line, not a stack.
process.on('uncaughtException', (error) => fail(error.message));
process.on('unhandledRejection', (error) => fail(error?.message ?? String(error)));
const host = restore({ root: opts.root, item: opts.item, spec, session: session ?? 'show', release });
if (command === 'start') {
  if (!opts.input) fail('start needs --input');
  inputs = [{ event: { type: 'xstate.init', input: JSON.parse(opts.input) }, source: { system: 'claude-code', ref: session } }];
}
const effects = { run: handlers({ github: github() }).run };
const results = command === 'show' ? [] : await offer(host, typeof inputs === 'function' ? inputs(host) : inputs, effects);
console.log(JSON.stringify({
  item: opts.item,
  owner: host.owner,
  state: host.snapshot?.value ?? null,
  results: results.map(({ outcome, row }) => ({ outcome, reason: row.payload.reason, event: row.payload.event?.type, source: row.source })),
  pending: pending(host)
}, null, 2));
