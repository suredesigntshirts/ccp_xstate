// agent.finish ms (plan item fix-agent-finish-ms): from the agent's brief to its last user or assistant row, so a row
// stamped with a relayed message's old time no longer stretches the run (plan/decisions/2026-11-05-agent-finish-ms.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLUGIN, runHook, temp } from './helpers.mjs';
import { READ_CAP, capture, read } from '../scripts/capture-rows.mjs';
import { readFile } from '../../../packages/journal/src/index.js';

const OLD = '2026-10-30T10:13:50.430Z';
const AGENT = 'a0000000000000001';
const at = (s) => `2026-11-05T13:24:${String(s).padStart(2, '0')}.000Z`;
const row = (type, timestamp, extra = {}) => ({ type, timestamp, isSidechain: true, agentId: AGENT, uuid: `${type}-${timestamp}`, ...extra });
const user = (t, text = 'ok') => row('user', t, { message: { role: 'user', content: text } });
const assistant = (t, id) => row('assistant', t, {
  message: { id, role: 'assistant', model: 'claude-haiku-5-5', content: [{ type: 'text', text: 'done' }], usage: { input_tokens: 1, output_tokens: 2 } },
});
const attachment = (t) => row('attachment', t, { attachment: { type: 'session_context', context: {} } });

// The shape of a real transcript: brief, attachments, a tool round, the answer; 7 s from brief to last row.
const real = () => [user(at(18), 'Count the entries.'), attachment(at(19)), assistant(at(20), 'm1'), user(at(22)), attachment(at(22)), assistant(at(25), 'm2')];

function file(entries, pad = '') {
  const path = join(temp('finish-ms'), `agent-${AGENT}.jsonl`);
  writeFileSync(path, pad + entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return path;
}

const ms = (path) => capture({ hook_event_name: 'SubagentStop', agent_id: AGENT, agent_transcript_path: path }, { read }).rows[0].payload.ms;

test('a real-shape transcript: ms is brief to last message', () => {
  assert.equal(ms(file(real())), 7000);
});

test('old-entry: an attachment and a user row stamped days before the brief do not count', () => {
  const entries = real();
  entries.splice(1, 0, attachment(OLD));
  entries.splice(4, 0, user(OLD, 'relayed'));
  assert.equal(ms(file(entries)), 7000);
});

test('non-message rows after the last message do not count', () => {
  assert.equal(ms(file([...real(), attachment('2026-11-05T13:30:00.000Z')])), 7000);
});

test('long-transcript: past the read cap the start is still the brief', () => {
  const [brief, ...rest] = real();
  const filler = Array.from({ length: Math.ceil(READ_CAP / 4096) + 2 }, () => attachment(at(21))).map((e) => ({ ...e, pad: 'x'.repeat(4000) }));
  assert.equal(ms(file([brief, ...filler, ...rest])), 7000);
});

test('no brief first: the earliest message read is the start', () => {
  const [, ...rest] = real();
  assert.equal(ms(file([attachment(OLD), ...rest])), 5000);
});

test('no message, an empty file, or no file: ms is null', () => {
  assert.equal(ms(file([attachment(at(19)), attachment(at(25))])), null);
  assert.equal(ms(file([])), null);
  assert.equal(ms(join(temp('finish-ms'), 'missing.jsonl')), null);
});

test('the verifier transcript of probe-plugin-agents-thread gives its real 4944', () => {
  const path = join(PLUGIN, '..', '..', 'test', 'regression', 'fixtures', 'agent-transcript.jsonl');
  assert.equal(ms(path), 4944);
});

test('through the hook: the journal row carries the real ms', () => {
  const dir = temp('finish-ms-hook');
  execFileSync(process.execPath, [join(PLUGIN, 'scripts', 'install.mjs')], { env: { PATH: process.env.PATH, CCP_HARNESS_DIR: dir } });
  const entries = real();
  entries.splice(1, 0, attachment(OLD));
  const path = file(entries);
  const input = { hook_event_name: 'SubagentStop', session_id: 'finish-ms-session', agent_id: AGENT, agent_type: 'Explore', agent_transcript_path: path };
  const r = runHook(join(PLUGIN, 'scripts', 'capture.mjs'), { env: { CCP_HARNESS_DIR: dir, CCP_HARNESS_STATE: join(dir, 'state') }, input });
  assert.equal(r.status, 0);
  const { rows } = readFile(join(dir, 'journal', 'sessions', 'finish-ms-session.jsonl'));
  assert.equal(rows.find((x) => x.kind === 'agent.finish').payload.ms, 7000);
});
