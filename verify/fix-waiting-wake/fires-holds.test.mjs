// Expect id `fires-holds` (fix-waiting-wake). A wake before the due time fires nothing; a wake past it journals the
// timer's event with source timer and the item holds: same state, ask run open, card up, no new card, no new timer.
// A tap on the card afterwards still moves the item (awaitingMerge -> merging -> done).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGitHub } from '../../packages/engine/test/parity/world.js';
import { A, PR, VERDICT, fresh, open, start, world, agents, handlersOf, offer, pending, inputsOfWake, tapWake, wakeAt, rowsOf, shift } from './lib.mjs';

const BRIEFS = { builder: 'b.md', verifier: 'v.md' };
const FAR = '2999-01-01T00:00:00Z';

test('fires-holds: before the due time nothing fires; after it the timer row is journalled and the item holds; a tap still moves it', async () => {
  const root = fresh();
  const w = world();
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const h = open(root, 'fh-1');
    const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }), gh.client);
    await offer(h, [start()], hs);
    assert.equal(h.snapshot.value, 'awaitingMerge');
    const [timer] = pending(h).timers;
    const askRun = pending(h).runs.find((r) => r.actor === 'ask');
    assert.ok(timer && askRun);
    const before = { rows: rowsOf(root, 'fh-1').length, cards: w.cards.length, wakes: w.wakes.length };

    // A wake one second before the due time, with now far ahead so the clamp does not hide it.
    const early = inputsOfWake(h, wakeAt(shift(timer.due, -1000)), { now: FAR });
    assert.equal(early.filter((i) => i.source.system === 'timer').length, 0, 'no timer input before the due time');
    await offer(h, early, hs);
    assert.equal(rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.source?.system === 'timer').length, 0);
    assert.equal(pending(h).timers.length, 1, 'timer still open');

    // The clamp: a wake claiming a time past due, but with the host's now before due, fires nothing either.
    const clamped = inputsOfWake(h, wakeAt(shift(timer.due, 60000)), { now: shift(timer.due, -1000) });
    assert.equal(clamped.filter((i) => i.source.system === 'timer').length, 0, 'a wake time never runs ahead of the host clock');

    // A wake one second past the due time.
    const late = inputsOfWake(h, wakeAt(shift(timer.due, 1000)), { now: FAR });
    const fired = late.filter((i) => i.source.system === 'timer');
    assert.equal(fired.length, 1);
    assert.deepEqual(fired[0].source, { system: 'timer', ref: timer.id });
    await offer(h, late, hs);
    const trow = rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.source?.system === 'timer');
    assert.equal(trow.length, 1, 'one timer row');
    assert.equal(trow[0].payload.outcome, 'applied', 'the timer event is taken, not refused');
    assert.equal(trow[0].source.ref, timer.id, 'source names the timer effect id');
    assert.equal(trow[0].payload.event.type, timer.event.type);
    assert.equal(JSON.parse(trow[0].state), 'awaitingMerge', 'state unchanged');

    assert.equal(h.snapshot.value, 'awaitingMerge');
    const p = pending(h);
    assert.deepEqual(p.runs.map((r) => r.id), [askRun.id], 'the ask run is still open');
    assert.deepEqual(p.timers, [], 'the fired timer is gone, no new timer');
    assert.deepEqual(p.effects, [], 'nothing pending: no stop, no cancel, no new card');
    assert.equal(w.cards.length, before.cards, 'no new card');
    assert.equal(w.wakes.length, before.wakes, 'no new wake asked for');
    assert.deepEqual(w.closes, [], 'no card closed');
    assert.ok(w.cards.every((c) => !c.closed));
    // No effect row under the timer's transition (no stop, cancel, run or timer).
    assert.deepEqual(rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.effect' && r.payload.transition === trow[0].id), []);

    // A second late wake fires nothing more.
    assert.equal(inputsOfWake(h, wakeAt(shift(timer.due, 5000)), { now: FAR }).filter((i) => i.source.system === 'timer').length, 0);

    // The tap still moves it.
    const card = w.cards.find((c) => c.key === askRun.id).ref;
    await offer(h, inputsOfWake(h, tapWake(card, 0), { now: FAR }), hs);
    // In seq order: the journal reader orders rows by time, and a wake's rows carry the wake's own time.
    const states = rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied')
      .sort((x, y) => x.payload.seq - y.payload.seq).map((r) => JSON.parse(r.state));
    assert.deepEqual(states.slice(-3), ['awaitingMerge', 'merging', 'done']);
    assert.equal(h.snapshot.value, 'done');
    assert.equal(gh.merges.length, 1);
  } finally {
    await gh.close();
  }
});
