// Verifier's characterisation of a GAP: C-finish-closes-waits is NOT met on the engine at the head (it is in
// packages/engine/test/parity/gaps.json, given to fix-finish-closes-waits). The case: given an item with an open
// decision, when the item finishes or is cancelled by another path, then the decision closes and nothing about it
// remains waiting for the person. These tests assert today's behaviour, which breaks the case's Then; the fix item
// that meets the case will turn them (and they should be deleted with its parity test). Re-characterised for the stage
// contract (engine-stage-contract): quick-fix now takes a PR merged outside the host (mergedOutside, lane A Q7) and
// moves to replanning, but the merge card it leaves is still never closed, and a replan card goes up: the case's Then
// (the decision closes, nothing waits on the person) still fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, PUSH, fresh, offer, open, pending, start, inputsOfWake } from './lib.mjs';
import { realHandlers, thread } from './gaps-lib.mjs';

const prMerged = `<wake reason="external-event" current-time="2026-10-30T19:27:48Z">
  <event source="github" kind="pull_request.closed" from="system" trust="relay">
    {"outcome":"merged","pr":"o/r#1"}
  </event>
</wake>`;

async function waitingOnCard() {
  const root = fresh();
  const host = open(root);
  const plat = thread();
  const effects = realHandlers({ plat });
  await offer(host, [start()], effects);
  assert.equal(host.snapshot.value, 'awaitingMerge');
  assert.equal(plat.cards.length, 1);
  return { root, host, plat, effects };
}

test('GAP C-finish-closes-waits: the PR merged by another path moves the item to replanning, but its merge card is never closed and a new card asks the person', async () => {
  const { host, plat, effects } = await waitingOnCard();
  const inputs = inputsOfWake(host, prMerged);
  const results = await offer(host, inputs, effects);
  assert.deepEqual(results.map((r) => r.outcome), ['applied'], 'the merged-elsewhere event is taken now');
  assert.equal(host.snapshot.value, 'replanning', 'the item does not finish: it asks to replan or drop');
  assert.equal(host.snapshot.context.failure.mergedOutside, 'o/r#1');
  assert.equal(pending(host).effects.filter((e) => e.type === 'stop').length, 1, 'the stop for the merge card is pending, never carried out');
  assert.equal(pending(host).runs.filter((r) => r.actor === 'ask').length, 1, 'an ask run is open: the person is still being waited on');
  assert.equal(plat.cards.length, 2, 'the merge card stays up beside the new replan card');
});

test('GAP C-finish-closes-waits: leaving the asking state emits a stop effect that nothing carries out, so the card stays up', async () => {
  const { host, plat, effects } = await waitingOnCard();
  assert.equal(effects.stop, undefined, 'the effect handlers have no stop handler');
  await offer(host, [{ event: PUSH(B), source: { system: 'github', ref: 'push-B' } }], effects);
  assert.equal(host.snapshot.value, 'verifying', 'the item left the state that asked');
  const open_ = pending(host).effects.filter((e) => e.type === 'stop');
  assert.equal(open_.length, 1, 'the stop effect for the old card is still pending, never carried out');
  assert.match(open_[0].id, /:stop$/);
  // The thread was never told to close the old card: its only interface here is card/post, and nothing else was called.
  assert.equal(plat.cards.length, 1, 'only the original card was ever made; nothing closed it');
  // And running the host again does not close it either.
  await offer(host, [], effects);
  assert.equal(pending(host).effects.filter((e) => e.type === 'stop').length, 1);
});
