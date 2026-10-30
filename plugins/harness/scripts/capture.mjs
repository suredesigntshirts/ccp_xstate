#!/usr/bin/env node
// Capture's hook (plan item obs-live-capture), registered in hooks/hooks.json on every event capture-rows.mjs handles. In a
// project that installed the harness, it appends the rows for one hook input to this session's journal file, stores
// any brief or answer under <journal>/blobs/<sha256> once, then appends a hook.run row with its own time.
// Like every hook here it does nothing elsewhere, prints nothing, swallows every failure and always exits 0. Its
// watchdog ends it within 3 s, inside the hook's 5 s timeout, after journalling hook.run with timedOut true.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { gate, journal, journalDir, pluginRoot, release, sessionFile, sessionName, stdin } from './host.mjs';
import { EVENTS, capture, read } from './capture-rows.mjs';

const WATCHDOG_MS = 3000;

/** This session's capture state (where the last Stop stopped reading the transcript): never under the plugin root. */
const statePath = (session, env = process.env) =>
  join(env.CCP_HARNESS_STATE || join(tmpdir(), 'ccp-harness'), `capture-${sessionFile(session)}`.replace(/\.jsonl$/, '.json'));

function loadState(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return {};
  }
}

function saveState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(`${path}.${process.pid}`, JSON.stringify(state));
  renameSync(`${path}.${process.pid}`, path);
}

/** Stores a blob once: the first writer of a hash wins and later ones change nothing. */
function store(dir, { hash, text }) {
  const path = join(dir, hash);
  try {
    writeFileSync(path, text, { flag: 'wx' });
  } catch (error) {
    if (error.code === 'ENOENT') {
      mkdirSync(dir, { recursive: true });
      return store(dir, { hash, text });
    }
    if (error.code !== 'EEXIST') throw error;
  }
}

let done = null; // journals hook.run once the session file and base are known
const exit = () => process.exit(0);
setTimeout(() => {
  try {
    done?.(true);
  } catch {}
  exit();
}, WATCHDOG_MS).unref();

try {
  if ((await gate(process.env, 500)) !== 'installed') exit();
  const input = JSON.parse((await stdin(500)) || '{}');
  if (!EVENTS.includes(input.hook_event_name)) exit();
  const root = pluginRoot();
  const session = sessionName(input);
  const path = join(journalDir(), 'sessions', sessionFile(session));
  const base = { session, item: null, state: null, release: release(root).version };
  const { append } = await journal(root);
  const event = input.hook_event_name;
  done = (timedOut) => {
    done = null;
    append(path, {
      ...base,
      agent: input.agent_id ?? null,
      kind: 'hook.run',
      source: { system: 'hook', ref: `${event} ${input.tool_use_id ?? input.agent_id ?? input.prompt_id ?? input.session_id ?? ''}`.trim() },
      payload: { name: `capture ${event}`, ms: Math.round(performance.now()), timedOut },
    });
  };
  const where = statePath(session);
  const usesState = event === 'Stop';
  const before = usesState ? loadState(where) : {};
  const { rows, blobs, state } = capture(input, { read, state: before });
  for (const b of blobs) store(join(journalDir(), 'blobs'), b);
  for (const row of rows) append(path, { ...base, ...row });
  if (usesState && state !== before) saveState(where, state);
  done(false);
} catch {}
exit();
