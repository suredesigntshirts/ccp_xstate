// C-waiting-does-not-stall (plan/cases/work-item.md): given one item waiting on a person's card, then another
// independent item still advances, and a wake is scheduled for the waiting one (plan item fix-waiting-wake;
// plan/decisions/2026-11-04-waiting-wake.md). Every state that asks the person sets a one-hour checkBack timer that
// moves nothing: the clock is asked for one wake keyed by the timer effect, the wake past its due time fires it, and
// the item keeps waiting with its card up until the person answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  A, B, BRIEFS, ISSUE, agents, cardOf, effectRows, fakeGitHub, inputsOfWakeFor, offer, open, openRun, pending,
  pr, pushed, start, tapWake, timeWake, toAwaitingMerge, transitions, verdict, world
} from './world.js';

const HOUR = 3600000;
const later = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

test('C-waiting-does-not-stall: an item waiting on its card has a wake scheduled, and another item still advances', async () => {
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const { root, host, plat, effects } = await toAwaitingMerge({ head: A, gh });
    assert.equal(host.snapshot.value, 'awaitingMerge');
    assert.equal(plat.open().length, 1, 'it waits on the person\'s merge card');

    // One wake is asked for, keyed by the timer effect, an hour after the item started waiting.
    const [timer] = pending(host).timers;
    assert.ok(timer, 'a timer is open while the item waits');
    assert.match(timer.timer, /^xstate\.after\.checkBack\..*\.awaitingMerge$/);
    assert.deepEqual(plat.wakes.map((w) => w.key), [timer.id]);
    const entering = transitions(root).find((r) => r.id === effectRows(root).find((e) => e.payload.effect === timer.id).payload.transition);
    assert.equal(entering.state, '"awaitingMerge"', 'the timer was set by the transition into awaitingMerge');
    assert.equal(Date.parse(timer.due) - Date.parse(entering.at), HOUR, 'due one hour after the item started waiting');
    assert.deepEqual(effectRows(root).filter((e) => e.payload.effect === timer.id).map((e) => e.payload.phase), ['start', 'done']);

    // An independent item advances to its own card meanwhile.
    const other = open(root, { item: 'it-2' });
    const issue2 = { ...ISSUE, url: 'https://github.com/o/r/issues/8' };
    const a2 = agents({ brief: BRIEFS, build: { pr: { ...pr(B).pr, url: 'https://github.com/o/r/pull/2', key: 'o/r#2' } }, verify: { ...verdict('PASS', B, issue2), pr: { url: 'https://github.com/o/r/pull/2', at: B } } });
    await offer(other, [start('owner', { issue: issue2 })], world({ gh, plat, actors: a2.byActor }));
    assert.equal(other.snapshot.value, 'awaitingMerge', 'the other item is not held by the first one\'s card');
    assert.equal(plat.wakes.length, 2, 'it too has its own wake scheduled');
    assert.equal(host.snapshot.value, 'awaitingMerge');

    // A wake before the due time fires nothing.
    assert.deepEqual(inputsOfWakeFor(host, timeWake(later(timer.due, -60000)), later(timer.due, -60000)), []);

    // The wake past it fires the timer: journalled with source timer, and nothing moves.
    const ask = openRun(host, 'ask');
    const fired = inputsOfWakeFor(host, timeWake(later(timer.due, 1000)));
    assert.deepEqual(fired.map((i) => i.source), [{ system: 'timer', ref: timer.id }]);
    const results = await offer(host, fired, effects);
    assert.equal(results[0].outcome, 'applied');
    assert.equal(host.snapshot.value, 'awaitingMerge');
    assert.equal(openRun(host, 'ask').id, ask.id, 'the same ask run is open');
    assert.deepEqual(plat.closes, [], 'the card is not closed');
    assert.equal(plat.cards.filter((c) => c.ref === cardOf(host, ask)).length, 1);
    assert.equal(plat.cards.length, 2, 'no new card: one per item');
    assert.equal(pending(host).timers.length, 0, 'one wake per wait: no new timer');
    assert.equal(plat.wakes.length, 2);
    const row = transitions(root).at(-1);
    assert.deepEqual(row.source, { system: 'timer', ref: timer.id });

    // The person's answer still moves it.
    await offer(host, inputsOfWakeFor(host, tapWake(cardOf(host, ask))), effects);
    assert.equal(host.snapshot.value, 'done');
  } finally {
    await gh.close();
  }
});

test('C-waiting-does-not-stall: leaving the waiting state drops its wake', async () => {
  const { host, plat, effects } = await toAwaitingMerge({ head: A });
  const [timer] = pending(host).timers;
  const dropped = [];
  effects.cancel = { ...effects.cancel, start: async (effect) => (dropped.push(effect.id), {}) };
  await offer(host, [{ event: pushed(B), source: { system: 'github', ref: `push ${B}` } }], effects);
  assert.notEqual(host.snapshot.value, 'awaitingMerge');
  assert.deepEqual(dropped, [`${timer.id}:cancel`]);
  assert.equal(pending(host).timers.length, 0);
  assert.equal(pending(host).effects.filter((e) => e.type === 'cancel').length, 0);
  assert.equal(plat.wakes.length, 1);
});
