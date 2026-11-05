// Expect long-transcript (fix-agent-finish-ms): a transcript over READ_CAP still starts at its brief, and the edge
// cases give the outputs line's answers (earliest message, null, null) without the hook failing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { HEAD, SESSION, finishOf, hook, rows, startInput, stopInput, world } from './lib.mjs';
import { edges, longTranscript } from './scenarios.mjs';
import { READ_CAP } from '../../plugins/harness/scripts/capture-rows.mjs';

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
