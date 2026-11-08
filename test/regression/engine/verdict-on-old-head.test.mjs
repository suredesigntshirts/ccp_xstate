// Expect: parity-cases/independent
// Case C-verdict-on-old-head: a PASS verdict for commit A, when the PR's head is commit B, can't reach merging, and the
// verdict is recorded as stale.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, BRIEFS, PR, VERDICT, fresh, handlersFor, offer, open, rowsOf, start } from '../lib.mjs';

// A push: CI green on the PR at a new head.
const PUSH = (sha) => ({ type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' });

test('PASS for A while the PR head is B never reaches awaitingMerge or merging; the verdict is kept as the stale one', async () => {
  const root = fresh();
  const host = open(root);
  const h = handlersFor({ brief: [BRIEFS], build: [PR(B)], verify: [VERDICT('PASS', A)] });
  await offer(host, [start()], h.handlers);
  assert.notEqual(host.snapshot.value, 'awaitingMerge');
  assert.notEqual(host.snapshot.value, 'merging');
  assert.equal(host.snapshot.value, 'replanning');
  assert.equal(host.snapshot.context.verdict.pr.at, A); // ported: verdict.sha -> verdict.pr.at
  assert.equal(host.snapshot.context.pr.at, B); // ported: pr.headSha -> pr.at
  const visited = rowsOf(root).filter((r) => r.kind === 'engine.transition').map((r) => r.state);
  assert.ok(!visited.some((s) => /awaitingMerge|merging/.test(s)), visited.join(' > '));
  assert.equal(h.count('merge'), 0);
});

test('the control: PASS for the head does wait to merge', async () => {
  const root = fresh();
  const host = open(root);
  const h = handlersFor({ brief: [BRIEFS], build: [PR(B)], verify: [VERDICT('PASS', B)] });
  await offer(host, [start()], h.handlers);
  assert.equal(host.snapshot.value, 'awaitingMerge');
});

test('a PASS verdict for A cannot be carried over a push: after a push to B, A\'s verdict does not merge', async () => {
  const root = fresh();
  const host = open(root);
  const h = handlersFor({ brief: [BRIEFS], build: [PR(A)], verify: [VERDICT('PASS', A)] });
  await offer(host, [start()], h.handlers);
  assert.equal(host.snapshot.value, 'awaitingMerge');
  await offer(host, [{ event: PUSH(B), source: { system: 'github', ref: 'p1' } }], h.handlers); // ported: the push is CI green at B
  assert.equal(host.snapshot.value, 'verifying');
  assert.equal(h.count('merge'), 0);
});
