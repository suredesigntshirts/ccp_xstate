// Expect unchanged (fix-agent-finish-ms): every row and blob capture writes is main's for the same inputs, apart from
// agent.finish ms, which changes only where a transcript holds non-message rows or rows before its brief.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HEAD, HERE } from './lib.mjs';
import { run } from './scenarios.mjs';

const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8'));
const head = run(HEAD);
const withoutMs = (s) => ({ ...s, rows: s.rows.map((r) => (r.kind === 'agent.finish' ? { ...r, payload: { ...r.payload, ms: '<ms>' } } : r)) });
const ms = (s) => s.rows.filter((r) => r.kind === 'agent.finish').map((r) => r.payload.ms);

test('unchanged: the same scenarios run at the head and at main', () => {
  assert.deepEqual(Object.keys(head).sort(), Object.keys(main).sort());
});

for (const name of Object.keys(main)) {
  test(`unchanged: ${name}: every row, payload and blob but agent.finish ms is main's`, () => {
    assert.deepEqual(withoutMs(head[name]), withoutMs(main[name]));
  });
}

test('unchanged: agent.finish ms is main\'s wherever the transcript is only messages from its brief', () => {
  for (const name of ['fixture', 'refusals', 'empty', 'unreadable']) assert.deepEqual(ms(head[name]), ms(main[name]), name);
  for (const name of ['oldEntry', 'long', 'notUserFirst', 'noMessages']) assert.notDeepEqual(ms(head[name]), ms(main[name]), name);
});
