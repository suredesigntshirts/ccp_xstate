// C-finish-closes-waits (plan/cases/work-item.md): given an item with an open decision, when the item finishes or is
// cancelled by another path, then the decision closes, and nothing about it remains waiting for the person (plan item
// fix-finish-closes-waits; plan/decisions/2026-11-04-finish-closes-waits.md). An item waits on its merge card and is
// moved on four ways: a push, a red check on its head, its PR merged on GitHub by another path, and its PR closed
// unmerged. Each time the card is closed once by its key, no stop is left pending, and no ask run is open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  A, B, offer, pending, pushed, inputsOfWakeFor, openRun, cardOf, tapWake, checkWake, toAwaitingMerge, fakeGitHub, effectRows
} from './world.js';

const closedWake = (outcome) => `<wake reason="external-event" current-time="2026-10-30T19:27:48Z">
  <event source="github" kind="pull_request.closed" from="system" trust="relay">
    {"outcome":"${outcome}","pr":"o/r#1"}
  </event>
</wake>`;

const PATHS = {
  push: (host) => [{ event: pushed(B), source: { system: 'github', ref: `push ${B}` } }],
  'red check': (host) => inputsOfWakeFor(host, checkWake({ head: A })),
  'merged elsewhere': (host) => inputsOfWakeFor(host, closedWake('merged')),
  'closed unmerged': (host) => inputsOfWakeFor(host, closedWake('closed'))
};
const TO = { push: 'verifying', 'red check': 'building', 'merged elsewhere': 'closedOutside', 'closed unmerged': 'closedOutside' };

for (const [path, inputs] of Object.entries(PATHS)) {
  test(`C-finish-closes-waits: leaving the merge card by ${path} closes the card, and nothing about it waits`, async () => {
    const gh = await fakeGitHub({ 1: { head: A } });
    try {
      const { root, host, plat, effects } = await toAwaitingMerge({ head: A, gh });
      assert.equal(host.snapshot.value, 'awaitingMerge');
      const ask = openRun(host, 'ask');
      const card = cardOf(host, ask);
      assert.equal(plat.open().length, 1);

      const results = await offer(host, inputs(host), effects);
      assert.equal(results[0].outcome, 'applied');
      assert.equal(host.snapshot.value, TO[path]);
      assert.deepEqual(plat.closes, [ask.id], 'the card is closed once, by the ask run\'s key');
      assert.equal(plat.cards.find((c) => c.ref === card).closed, true);
      assert.equal(pending(host).effects.filter((e) => e.type === 'stop').length, 0, 'no stop is left pending');
      assert.equal(pending(host).runs.filter((r) => r.actor === 'ask').length, 0, 'no ask run is open');
      const stop = effectRows(root).filter((r) => r.payload.effect === `${ask.id}:stop`);
      assert.deepEqual(stop.map((r) => r.payload.phase), ['start', 'done']);
      assert.deepEqual(stop.at(-1).payload.outcome, { closed: card });

      // A tap on the closed card moves nothing.
      assert.deepEqual(inputsOfWakeFor(host, tapWake(card)), []);
      if (TO[path] === 'closedOutside') {
        assert.equal(plat.cards.length, 1, 'no new card asks the person anything');
        assert.equal(host.snapshot.status, 'done', 'the item has ended');
        assert.equal(host.snapshot.context.merge ?? null, null, 'never done: the host made no merge');
        assert.deepEqual(gh.merges, []);
        assert.equal(effectRows(root).filter((r) => r.payload.actor === 'merge').length, 0);
        assert.equal(host.snapshot.context.failure.closedOutside, 'o/r#1');
      }
    } finally {
      await gh.close();
    }
  });
}

test('C-finish-closes-waits: a stopped agent run, and an ask whose card was never made, close nothing and wait on no one', async () => {
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const { root, host, plat, effects } = await toAwaitingMerge({ head: A, gh });
    // A push leaves the merge card; the new verify run's agent never returns, and a red check on B leaves it.
    await offer(host, [{ event: pushed(B), source: { system: 'github', ref: `push ${B}` } }], effects);
    assert.equal(host.snapshot.value, 'verifying');
    const verify = openRun(host, 'verify');
    assert.ok(verify, 'the verify run is open (its agent has not returned)');
    await offer(host, inputsOfWakeFor(host, checkWake({ head: B })), effects);
    assert.ok(['building', 'replanning'].includes(host.snapshot.value), host.snapshot.value);
    const stop = effectRows(root).filter((r) => r.payload.effect === `${verify.id}:stop`);
    assert.deepEqual(stop.map((r) => r.payload.phase), ['start', 'done']);
    assert.deepEqual(stop.at(-1).payload.outcome, { closed: null }, 'an agent run has nothing in front of the person');
    assert.equal(plat.closes.length, 1, 'only the merge card was closed');
    assert.equal(pending(host).effects.filter((e) => e.type === 'stop').length, 0);
  } finally {
    await gh.close();
  }
});

test('C-finish-closes-waits: the stop of an ask whose card was never made closes nothing', async () => {
  const { effects, plat } = await toAwaitingMerge({ head: A });
  const outcome = await effects.stop.start({ id: 'it-9:3.ask:stop', type: 'stop', run: 'it-9:3.ask', actor: 'ask' });
  assert.deepEqual(outcome, { closed: null });
  assert.deepEqual(plat.closes, ['it-9:3.ask']);
  assert.equal(plat.open().length, 1, 'the other item\'s card is untouched');
});

test('C-finish-closes-waits: with no way to close a card, the ask\'s stop stays pending for a host that has one', async () => {
  const { handlers } = await import('../../src/effects/index.js');
  const none = handlers({ hearth: { card: async () => ({ ref: 'c' }), post: async () => ({ ref: 'p' }) } });
  assert.equal(none.stop.handles({ type: 'stop', run: 'it-1:3.ask', actor: 'ask' }), false);
  assert.equal(none.stop.handles({ type: 'stop', run: 'it-1:3.verify', actor: 'verify' }), true);
});
