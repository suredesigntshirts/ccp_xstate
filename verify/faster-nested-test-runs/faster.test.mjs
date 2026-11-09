// Expect: faster-nested-test-runs/faster
// Run alone on one machine, the changed test files' summed time at the head is at most 60% of the base's: medians of
// three alternating rounds (record.mjs), read from evidence/faster.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILES, BASE, VERIFIED, evidence } from './lib.mjs';

const e = evidence('faster');
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

test('three rounds, alternating which side runs first, each summing every changed file', () => {
  assert.equal(e.base, BASE);
  assert.equal(e.head, VERIFIED);
  assert.equal(e.rounds.length, 3);
  assert.deepEqual(e.rounds.map((r) => r.first), ['base', 'head', 'base']);
  for (const r of e.rounds) assert.equal(r.files, FILES.length);
});

test('head median summed time is at most 60% of the base median', () => {
  const b = median(e.rounds.map((r) => r.base_ms)), h = median(e.rounds.map((r) => r.head_ms));
  assert.equal(b, e.base_median_ms);
  assert.equal(h, e.head_median_ms);
  assert.ok(h <= 0.6 * b, `head ${h} ms vs base ${b} ms: ${(h / b).toFixed(3)}`);
});
