// Expect left-closes: a quick-fix item waiting on its merge card, moved on four ways (one fresh item each), has its
// card closed exactly once by its key, no stop pending and no ask open; the two closed wakes end in closedOutside,
// never done, with no new card and no merge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, item, offer, PUSH, RED, CLOSED, stopsPending, asksOpen, rowsOf } from './lib.mjs';

async function waiting() {
  const it = await item();
  assert.equal(it.host.snapshot.value, 'awaitingMerge');
  assert.equal(it.thread.cards.length, 1, 'the merge card is up');
  assert.equal(asksOpen(it.host).length, 1);
  return it;
}

function closedOnce(it, card) {
  assert.equal(it.thread.closes.length, 1, `closed exactly once: ${JSON.stringify(it.thread.closes)}`);
  assert.deepEqual(it.thread.closes[0], { key: card.key, ref: card.ref }, 'closed by the key the card was made with');
  assert.deepEqual(stopsPending(it.host), [], 'no stop effect left pending');
  assert.deepEqual(asksOpen(it.host), [], 'no ask run open');
  // Journal rows: the stop's start and done, done with outcome { closed: <card id> }.
  const stopRows = rowsOf(it.root).filter((r) => r.kind === 'engine.effect' && r.payload.effect === `${card.key}:stop`);
  assert.deepEqual(stopRows.map((r) => r.payload.phase), ['start', 'done']);
  assert.deepEqual(stopRows[1].payload.outcome, { closed: card.ref });
  assert.equal(stopRows[1].payload.actor, 'ask');
  return stopRows;
}

for (const [name, input, states] of [
  ['a push', PUSH(B), null],
  ['a red check on the head', RED(A), ['building', 'replanning']]
]) {
  test(`left-closes: ${name} closes the merge card once`, async () => {
    const it = await waiting();
    const card = it.thread.cards[0];
    await offer(it.host, [input], it.effects);
    assert.notEqual(it.host.snapshot.value, 'awaitingMerge', 'the item left the state that asked');
    if (states) assert.ok(states.includes(it.host.snapshot.value), it.host.snapshot.value);
    closedOnce(it, card);
    // Offering again does not close again.
    await offer(it.host, [], it.effects);
    assert.equal(it.thread.closes.length, 1);
  });
}

for (const outcome of ['merged', 'closed']) {
  test(`left-closes: the PR ${outcome} on GitHub ends in closedOutside with the card closed, no new card, no merge`, async () => {
    const it = await waiting();
    const card = it.thread.cards[0];
    const results = await offer(it.host, [CLOSED(outcome)], it.effects);
    assert.deepEqual(results.map((r) => r.outcome), ['applied']);
    assert.equal(it.host.snapshot.value, 'closedOutside');
    assert.notEqual(it.host.snapshot.value, 'done');
    assert.equal(it.host.snapshot.status, 'done', 'a final state');
    assert.equal(it.host.snapshot.context.failure.closedOutside, 'o/r#1');
    assert.equal(it.host.snapshot.context.failure.outcome, outcome);
    closedOnce(it, card);
    assert.equal(it.thread.cards.length, 1, 'no second card');
    assert.equal(it.merges.length, 0, 'no merge run');
    const rows = rowsOf(it.root);
    assert.ok(!rows.some((r) => r.kind === 'engine.effect' && r.payload.actor === 'merge'), 'no merge effect row');
    assert.equal(rows.filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'ask' && r.payload.type === 'run' && r.payload.phase === 'start').length, 1, 'one ask run ever started');
  });
}

test('left-closes: a PR closed event for another PR moves nothing', async () => {
  const it = await waiting();
  await offer(it.host, [{ ...CLOSED('merged'), event: { ...CLOSED('merged').event, pr: 'o/r#2' }, source: { system: 'github', ref: 'other' } }], it.effects);
  assert.equal(it.host.snapshot.value, 'awaitingMerge');
  assert.equal(it.thread.closes.length, 0);
});
