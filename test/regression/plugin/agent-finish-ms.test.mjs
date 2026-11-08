// Expect: fix-agent-finish-ms/old-entry, fix-agent-finish-ms/long-transcript
// agent.finish ms, through the real capture hook: from the brief to the last message, whatever rows come before or after it, a transcript over the read cap included.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { READ_CAP } from '../../../plugins/harness/scripts/capture-rows.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HEAD = join(HERE, '..', '..', '..');
const OLD = '2026-10-30T10:13:50.430Z'; // written_at of the person's relayed "User is not around" message
const REAL = join(HERE, '..', 'fixtures', 'agent-transcript.jsonl');
const SESSION = '5e551011-0000-4000-8000-00000000f1a5';

/** The 8 user and assistant rows of a real subagent transcript (probe-plugin-agents-thread's verifier agent). */
const realRows = () => readFileSync(REAL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const iso = (ms) => new Date(ms).toISOString();

/** An attachment row in the shape Claude Code writes them (copied from a live transcript's fields). */
function attachment(timestamp, agentId, kind = 'deferred_tools_delta') {
  return {
    parentUuid: null, isSidechain: true, agentId,
    attachment: kind === 'deferred_tools_delta' ? { type: kind, addedNames: ['WebFetch', 'WebSearch'] } : { type: kind, date: '2026-11-05' },
    type: 'attachment', uuid: `att-${Math.random().toString(16).slice(2)}`, timestamp,
    userType: 'external', entrypoint: 'remote_projects', cwd: '/home/user/ccp_xstate', sessionId: SESSION, version: '2.1.318',
  };
}

/** A user row like the relayed message's: a person's words stamped with when they were written. */
function relayedUser(timestamp, agentId) {
  return {
    parentUuid: null, isSidechain: true, agentId, type: 'user', timestamp, userType: 'external', uuid: `rel-${Math.random().toString(16).slice(2)}`,
    message: { role: 'user', content: 'User is not around. You will have to enable things and answer your own questions.' },
  };
}

/**
 * The old-entry transcript: the real 8 rows, with an attachment row and a user row stamped OLD after the brief, an
 * attachment at the run, and one trailing attachment a minute after the last message (which must not count either).
 */
function oldEntryTranscript() {
  const rows = realRows();
  const id = rows[0].agentId;
  const t0 = Date.parse(rows[0].timestamp);
  const last = Date.parse(rows.at(-1).timestamp);
  const out = [rows[0], attachment(OLD, id), relayedUser(OLD, id), attachment(iso(t0 + 50), id, 'date'), ...rows.slice(1), attachment(iso(last + 60_000), id, 'date')];
  return { rows: out, agentId: id, expected: last - t0 };
}

const install = (repo, dir) =>
  execFileSync(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'install.mjs')], { env: { PATH: process.env.PATH, CCP_HARNESS_DIR: dir } });

/** A fresh harness folder installed by `repo`'s install script, and a project folder for transcripts. */
function world(repo) {
  const root = mkdtempSync(join(tmpdir(), 'verify-finish-ms-'));
  const harness = join(root, 'harness');
  mkdirSync(harness);
  install(repo, harness);
  mkdirSync(join(harness, 'journal', 'sessions'), { recursive: true });
  const project = join(root, 'project');
  mkdirSync(join(project, SESSION, 'subagents'), { recursive: true });
  writeFileSync(join(project, `${SESSION}.jsonl`), '');
  return { root, harness, project, transcript: join(project, `${SESSION}.jsonl`) };
}

/** Writes a subagent's transcript (rows or raw text) and meta beside the parent's transcript. Returns its path. */
function writeAgent(w, agentId, rows, metaJson = { agentType: 'general-purpose', isBuiltIn: true }) {
  const path = join(w.project, SESSION, 'subagents', `agent-${agentId}.jsonl`);
  writeFileSync(path, typeof rows === 'string' ? rows : rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(w.project, SESSION, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify(metaJson));
  return path;
}

const startInput = (w, agentId, type = 'general-purpose') =>
  ({ session_id: SESSION, transcript_path: w.transcript, cwd: '/home/user/ccp_xstate', agent_id: agentId, agent_type: type, hook_event_name: 'SubagentStart' });
const stopInput = (w, agentId, path, type = 'general-purpose') => ({
  session_id: SESSION, transcript_path: w.transcript, cwd: '/home/user/ccp_xstate', permission_mode: 'auto', agent_id: agentId, agent_type: type,
  hook_event_name: 'SubagentStop', stop_hook_active: false, agent_transcript_path: path, background_tasks: [], session_crons: [],
});

/** Pipes one hook input into `repo`'s real capture hook, as Claude Code runs it. */
function hook(repo, w, input) {
  const env = { PATH: process.env.PATH, CCP_HARNESS_DIR: w.harness, CCP_HARNESS_STATE: join(w.root, 'state') };
  const r = spawnSync(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'capture.mjs')], { input: JSON.stringify(input), env, encoding: 'utf8', timeout: 20_000 });
  if (r.status !== 0 || r.stdout || r.stderr) throw new Error(`capture hook: ${r.status} ${r.stdout} ${r.stderr}`);
}

/** Every row in the harness folder's session journals, in file order. */
function rows(w) {
  const dir = join(w.harness, 'journal', 'sessions');
  return readdirSync(dir).sort().flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

/** Runs one subagent's start and stop through `repo`'s hook and returns its agent.finish row. */
function finishOf(repo, rowsOrText, agentId = 'a0000000000000001') {
  const w = world(repo);
  const path = writeAgent(w, agentId, rowsOrText);
  hook(repo, w, startInput(w, agentId));
  hook(repo, w, stopInput(w, agentId, path));
  const finish = rows(w).filter((r) => r.kind === 'agent.finish');
  if (finish.length !== 1) throw new Error(`expected one agent.finish, got ${finish.length}`);
  return finish[0];
}

const T0 = Date.parse('2026-11-05T14:00:00.000Z');
const user = (ms, agentId, content = 'go on') => ({ parentUuid: null, isSidechain: true, agentId, type: 'user', timestamp: iso(ms), message: { role: 'user', content } });
const assistant = (ms, agentId, text = 'ok') => ({
  parentUuid: null, isSidechain: true, agentId, type: 'assistant', timestamp: iso(ms),
  message: { model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'text', text }], usage: { input_tokens: 3, output_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 11 } },
});

/** A transcript over the read cap whose brief is its first line: 30 s from brief to last message. */
function longTranscript(agentId = 'a10000000000000l0') {
  const pad = 'x'.repeat(64 * 1024);
  const rows = [user(T0, agentId, 'the brief')];
  for (let i = 0; i < 150; i++) rows.push({ ...attachment(iso(T0 + 1000 + i), agentId, 'date'), padding: pad });
  rows.push(assistant(T0 + 20_000, agentId, 'working'), user(T0 + 25_000, agentId), assistant(T0 + 30_000, agentId, 'done'));
  return { rows, agentId, expected: 30_000 };
}

// The edge cases the outputs line names: first line not a user row, empty, unreadable, no message rows.
const edges = (id) => ({
  notUserFirst: { rows: [attachment(iso(T0), id, 'date'), assistant(T0 + 2000, id), user(T0 + 3000, id), assistant(T0 + 9000, id)], expected: 7000 },
  empty: { rows: '', expected: null },
  noMessages: { rows: [attachment(iso(T0), id, 'date'), attachment(iso(T0 + 5000), id)], expected: null },
});

test('long-transcript: over READ_CAP with the brief first, ms starts at the brief', () => {
  const t = longTranscript();
  const text = t.rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  assert.ok(Buffer.byteLength(text) > READ_CAP, 'the transcript is longer than the read cap');
  assert.equal(finishOf(HEAD, text, t.agentId).payload.ms, t.expected);
});

for (const [name, c] of Object.entries(edges('a20000000000000e0'))) {
  test(`long-transcript: ${name} gives ${c.expected}`, () => {
    assert.equal(finishOf(HEAD, c.rows, 'a20000000000000e0').payload.ms, c.expected);
  });
}

test('long-transcript: an unreadable transcript gives null, and the hook still writes its rows', () => {
  const w = world(HEAD);
  const id = 'a30000000000000u0';
  hook(HEAD, w, startInput(w, id));
  hook(HEAD, w, stopInput(w, id, join(w.project, SESSION, 'subagents', `agent-${id}.jsonl`)));
  const finish = rows(w).filter((r) => r.kind === 'agent.finish');
  assert.equal(finish.length, 1);
  assert.equal(finish[0].payload.ms, null);
  assert.ok(rows(w).filter((r) => r.kind === 'hook.run').every((r) => !r.payload.timedOut && !r.payload.error));
});

test('old-entry: ms is the brief to the last message, within 10 ms, despite rows stamped days before', () => {
  const t = oldEntryTranscript();
  assert.ok(t.rows.some((r) => r.type === 'attachment' && r.timestamp === OLD));
  assert.ok(t.rows.some((r) => r.type === 'user' && r.timestamp === OLD));
  const row = finishOf(HEAD, t.rows, t.agentId);
  assert.equal(t.expected, 4944); // the real run's span, 07:21:22.508Z to 07:21:27.452Z
  assert.ok(Math.abs(row.payload.ms - t.expected) <= 10, `ms ${row.payload.ms}, expected ${t.expected}`);
  assert.equal(row.payload.agentId, t.agentId);
});

