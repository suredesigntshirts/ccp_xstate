#!/usr/bin/env node
// The host from the command line, one item per call (plan item engine-host). See packages/engine/README.md.
//
//   host.js start --item <id> --workflow <name> --input <json> --session <id> [--root <dir>] [--release x.y.z]
//   host.js wake  --item <id> --workflow <name> [--root <dir>] [--release x.y.z]   < hook input JSON
//   host.js show  --item <id> --workflow <name> [--root <dir>]
//
// wake reads a Claude Code hook's input on stdin: UserPromptSubmit (the wake is its prompt) or PostToolUse of
// ReadNotifications (the wakes are in its result). The session is the hook input's session_id. Nothing on the
// command line can name an event or its source: those come only from the wake text. No effect handlers run here yet
// (engine-effects and engine-actors add them), so effects stay pending and are printed.
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { loadWorkflow } from '../src/index.js';
import { restore, offer, pending } from '../src/host.js';
import { inputsOfWake } from '../src/wake.js';

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

// Every string inside a hook input's prompt or tool result, joined: a ReadNotifications result holds its wakes as
// strings nested in JSON.
const textsOf = (value) =>
  typeof value === 'string' ? [value] : value && typeof value === 'object' ? Object.values(value).flatMap(textsOf) : [];

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
  const text = textsOf(hook.hook_event_name === 'PostToolUse' ? hook.tool_response : hook.prompt).join('\n');
  inputs = (host) => inputsOfWake(host, text);
}
if (!session && command !== 'show') fail('no session: start takes --session, wake reads session_id from the hook input');

const host = restore({ root: opts.root, item: opts.item, spec, session: session ?? 'show', release });
if (command === 'start') {
  if (!opts.input) fail('start needs --input');
  inputs = [{ event: { type: 'xstate.init', input: JSON.parse(opts.input) }, source: { system: 'claude-code', ref: session } }];
}
const results = command === 'show' ? [] : await offer(host, typeof inputs === 'function' ? inputs(host) : inputs);
console.log(JSON.stringify({
  item: opts.item,
  owner: host.owner,
  state: host.snapshot?.value ?? null,
  results: results.map(({ outcome, row }) => ({ outcome, reason: row.payload.reason, event: row.payload.event?.type, source: row.source })),
  pending: pending(host)
}, null, 2));
