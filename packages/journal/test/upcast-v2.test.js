// The v1 to v2 upcaster: each v1 use of brief.stored and result.stored reads as its own kind, and agent.spawn's
// briefHash reads as promptHash; every other row is unchanged, and the file is never touched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, upcast, VERSION } from '../src/index.js';

const v1 = (kind, payload, extra = {}) => ({
  v: 1, id: `${kind}-${Object.keys(payload).join('-')}`, at: '2026-11-01T10:00:00.000Z', kind,
  source: { system: 'journal', ref: 'blobs/abc' }, session: 's', release: '0.1.35', payload, ...extra,
});

test('the journal is at v2', () => assert.equal(VERSION, 2));

test('an engine prompt row (brief.stored with contextHash) reads as prompt.stored, payload unchanged', () => {
  const row = v1('brief.stored', { run: 'it:0.build', actor: 'build', role: 'build', hash: 'h', bytes: 1, contextHash: 'c', worktree: '/w' });
  const up = upcast(row);
  assert.equal(up.kind, 'prompt.stored');
  assert.deepEqual(up.payload, row.payload);
  assert.equal(up.v, 2);
});

test('a returned brief (brief.stored with run, role and no contextHash) stays brief.stored', () => {
  const row = v1('brief.stored', { run: 'it:0.brief', actor: 'brief', role: 'verifier', hash: 'h', bytes: 1 });
  assert.deepEqual(upcast(row), { ...row, v: 2 });
});

test('a capture prompt row (brief.stored with no run) reads as agent.prompt', () => {
  const row = v1('brief.stored', { agentId: 'a1', hash: 'h', bytes: 1 }, { agent: 'a1' });
  assert.deepEqual(upcast(row), { ...row, kind: 'agent.prompt', v: 2 });
});

test('a capture final message (result.stored with no run) reads as agent.final; an engine accept stays result.stored', () => {
  const capture = v1('result.stored', { agentId: 'a1', hash: 'h', bytes: 1 }, { agent: 'a1' });
  assert.deepEqual(upcast(capture), { ...capture, kind: 'agent.final', v: 2 });
  const accept = v1('result.stored', { run: 'it:0.build', actor: 'build', agentId: 'a1', hash: 'h', bytes: 1, toolUseId: 't' });
  assert.deepEqual(upcast(accept), { ...accept, v: 2 });
});

test('agent.spawn payload briefHash reads as promptHash, null or not', () => {
  for (const hash of ['h', null]) {
    const row = v1('agent.spawn', { agentId: 'a1', type: 'general-purpose', briefHash: hash, depth: 1 });
    const up = upcast(row);
    assert.equal(up.payload.promptHash, hash);
    assert.equal('briefHash' in up.payload, false);
    assert.equal(up.payload.agentId, 'a1');
  }
});

test('other rows only gain v2', () => {
  const row = v1('tool.call', { tool: 'Bash', inputHash: 'x', inputBytes: 2, ms: 3, ok: true });
  assert.deepEqual(upcast(row), { ...row, v: 2 });
});

test('readFile upcasts a v1 file and leaves it as it was', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'upcast-')), 'a.jsonl');
  const text = [v1('brief.stored', { agentId: 'a1', hash: 'h', bytes: 1 }), v1('result.stored', { agentId: 'a1', hash: 'h', bytes: 1 })].map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(path, text);
  const { rows, bad } = readFile(path);
  assert.deepEqual(bad, []);
  assert.deepEqual(rows.map((r) => r.kind), ['agent.prompt', 'agent.final']);
  assert.equal(readFileSync(path, 'utf8'), text);
});
