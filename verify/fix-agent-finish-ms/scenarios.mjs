// The verifier's scenarios for fix-agent-finish-ms, each run through a checkout's real capture hook.
// `node scenarios.mjs <checkout>` prints { scenario: rows } with run-to-run noise taken out (lib.mjs norm), so the same
// inputs can be recorded at main (evidence/main-scenarios.json) and compared at the head.
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HEAD, OLD, SESSION, attachment, blobs, hook, norm, oldEntryTranscript, rows, startInput, stopInput, world, writeAgent } from './lib.mjs';

const T0 = Date.parse('2026-11-05T14:00:00.000Z');
const iso = (ms) => new Date(ms).toISOString();
const user = (ms, agentId, content = 'go on') => ({ parentUuid: null, isSidechain: true, agentId, type: 'user', timestamp: iso(ms), message: { role: 'user', content } });
const assistant = (ms, agentId, text = 'ok') => ({
  parentUuid: null, isSidechain: true, agentId, type: 'assistant', timestamp: iso(ms),
  message: { model: 'claude-opus-5-5', role: 'assistant', content: [{ type: 'text', text }], usage: { input_tokens: 3, output_tokens: 5, cache_read_input_tokens: 7, cache_creation_input_tokens: 11 } },
});

export const READ_CAP_BYTES = 8 * 1024 * 1024;

/** A transcript over the read cap whose brief is its first line: 30 s from brief to last message. */
export function longTranscript(agentId = 'a10000000000000l0') {
  const pad = 'x'.repeat(64 * 1024);
  const rows = [user(T0, agentId, 'the brief')];
  for (let i = 0; i < 150; i++) rows.push({ ...attachment(iso(T0 + 1000 + i), agentId, 'date'), padding: pad });
  rows.push(assistant(T0 + 20_000, agentId, 'working'), user(T0 + 25_000, agentId), assistant(T0 + 30_000, agentId, 'done'));
  return { rows, agentId, expected: 30_000 };
}

// The edge cases the outputs line names: first line not a user row, empty, unreadable, no message rows.
export const edges = (id) => ({
  notUserFirst: { rows: [attachment(iso(T0), id, 'date'), assistant(T0 + 2000, id), user(T0 + 3000, id), assistant(T0 + 9000, id)], expected: 7000 },
  empty: { rows: '', expected: null },
  noMessages: { rows: [attachment(iso(T0), id, 'date'), attachment(iso(T0 + 5000), id)], expected: null },
});

function agentScenario(repo, agentId, transcript, { missing = false } = {}) {
  const w = world(repo);
  const path = missing ? join(w.project, SESSION, 'subagents', `agent-${agentId}.jsonl`) : writeAgent(w, agentId, transcript);
  hook(repo, w, startInput(w, agentId));
  hook(repo, w, stopInput(w, agentId, path));
  return { rows: norm(rows(w), w.root), blobs: blobs(w) };
}

export function run(repo) {
  const out = {};
  const old = oldEntryTranscript();
  out.oldEntry = agentScenario(repo, old.agentId, old.rows);
  const long = longTranscript();
  out.long = agentScenario(repo, long.agentId, long.rows);
  for (const [name, c] of Object.entries(edges('a20000000000000e0'))) out[name] = agentScenario(repo, 'a20000000000000e0', c.rows);
  out.unreadable = agentScenario(repo, 'a30000000000000u0', null, { missing: true });

  // Every hook capture handles, from main's recorded capture fixture (copied, so both checkouts read the same files).
  {
    const w = world(repo);
    const src = join(HEAD, 'plugins', 'harness', 'test', 'fixtures', 'capture');
    cpSync(src, join(w.root, 'fixture'), { recursive: true });
    const events = readFileSync(join(src, 'events.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l.replaceAll('<fixture>', join(w.root, 'fixture'))));
    for (const e of events) hook(repo, w, e);
    out.fixture = { rows: norm(rows(w), w.root), blobs: blobs(w) };
  }
  // Refusals: the recorded hook-and-permission transcript read at a Stop and at a SubagentStop, and a classifier denial
  // retried then run.
  {
    const w = world(repo);
    const t = join(w.root, 'refusals.jsonl');
    cpSync(join(HEAD, 'plugins', 'harness', 'test', 'fixtures', 'refusals', 'hook-and-permission.jsonl'), t);
    hook(repo, w, { session_id: SESSION, transcript_path: t, hook_event_name: 'Stop', stop_hook_active: false });
    hook(repo, w, { session_id: SESSION, transcript_path: w.transcript, agent_id: 'a40000000000000r0', agent_type: 'general-purpose', hook_event_name: 'SubagentStop', agent_transcript_path: t });
    const probed = JSON.parse(readFileSync(join(HEAD, 'probes', 'platform', 'fixtures', 'refusals', '2026-10-30-self-modification-live-mod-and-hook.jsonl'), 'utf8').split('\n')[0]).input;
    const input = { ...probed, session_id: SESSION, transcript_path: join(w.root, 'none.jsonl') };
    for (const e of [input, { ...input, tool_use_id: 'toolu_retry' }, { ...input, hook_event_name: 'PostToolUse', tool_use_id: 'toolu_ran', tool_response: {} }]) hook(repo, w, e);
    out.refusals = { rows: norm(rows(w), w.root), blobs: blobs(w) };
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repo = process.argv[2] ?? HEAD;
  const result = run(repo);
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(result, null, 1) + '\n');
  else process.stdout.write(JSON.stringify(result, null, 1) + '\n');
}
