// prFacts keeps every Claude-Session trailer on a PR's commits, as written, once each.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prFacts } from '../bin/derive.js';

const commit = (sha, message) => ({ sha, parents: [{}], commit: { message, committer: { date: '2026-11-01T00:00:00Z' } } });
const raw = {
  '/repos/o/r/pulls/1': { head: { ref: 'build/x' }, merged_at: null, body: 'Item: x', labels: [] },
  '/repos/o/r/pulls/1/commits?per_page=100&page=1': [
    commit('a', 'One\n\nClaude-Session: https://claude.ai/code/session_A\nClaude-Session: https://claude.ai/code/session_B#agent=verifier\n'),
    commit('b', 'Two\n\nClaude-Session: session_C\n'),
    commit('c', 'Three\n\nClaude-Session: 3f2a-local-id\nClaude-Session: https://claude.ai/code/session_A\n'),
    commit('d', 'Four, no trailer'),
  ],
  '/repos/o/r/pulls/1/files?per_page=100&page=1': [{ filename: 'a.js', changes: 2 }],
};
const get = async (p) => {
  if (p.includes('/check-runs')) return { check_runs: [] };
  if (!(p in raw)) throw new Error(`not recorded: ${p}`);
  return raw[p];
};

test('prFacts keeps every Claude-Session trailer, in every form, deduplicated', async () => {
  const facts = await prFacts('o/r', 1, { get });
  assert.deepEqual(facts.sessions, [
    'https://claude.ai/code/session_A',
    'https://claude.ai/code/session_B#agent=verifier',
    'session_C',
    '3f2a-local-id',
  ]);
});
