// Verifier's characterisation of a GAP: C-two-hosts-one-item is NOT met on the engine at the head (gaps.json, given to
// fix-other-host-runs-effects). The case: given an item owned by one thread, when another session's host receives an
// event for it, it doesn't apply it; the event is journalled as forwarded or refused, and no effect runs twice.
// The first part holds (not-owner); the last does not: offer() first runs the item's open effects whoever owns it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, fresh, offer, open, pending, rowsOf, sessionRowsOf, start } from './lib.mjs';
import { agentActors, realHandlers, thread } from './gaps-lib.mjs';

test('GAP C-two-hosts-one-item: another session\'s host turns the event away but posts the owner\'s pending card, and the owner posts it again', async () => {
  const root = fresh();
  // The owner files the item. Its host has no thread client here (as a command run from a shell), so the card is left pending.
  const owner = open(root, { session: 'owner' });
  await offer(owner, [start('owner')], realHandlers({ hearth: false, actors: agentActors() }));
  assert.equal(owner.snapshot.value, 'awaitingMerge');
  assert.equal(pending(owner).effects.filter((e) => e.actor === 'ask').length, 1, 'the owner\'s card is pending');

  // Another session's host (it has the thread) receives an event for the item.
  const plat = thread();
  const other = open(root, { session: 'other' });
  assert.equal(other.owner, 'owner');
  const [result] = await offer(other, [{ event: { type: 'pr.pushed', headSha: B }, source: { system: 'github', ref: 'p1' } }], realHandlers({ plat }));
  assert.equal(result.outcome, 'not-owner', 'the first part of the case holds: the event is not applied');
  assert.ok(sessionRowsOf(root, 'other').some((r) => r.payload?.outcome === 'not-owner'), 'and is journalled in the other session\'s file');
  assert.equal(other.snapshot.value, 'awaitingMerge');

  // But the case's last clause fails: the non-owner host carried out the owner's effect (posted its card)...
  assert.equal(plat.cards.length, 1, 'a non-owner host posted the owner\'s pending card');
  const wroteToOwnersFile = rowsOf(root).filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'ask').map((r) => r.payload.phase);
  assert.deepEqual(wroteToOwnersFile, ['start', 'done'], 'and wrote its effect rows into the owner\'s file');

  // ...so when the owner's host comes back it is not the only one that has acted on that effect. Restored together
  // (before the other host\'s rows were visible) the effect runs twice; here, after them, the card is not re-posted,
  // which shows it was the OTHER session that did the owner\'s effect.
  const plat2 = thread();
  const back = open(root, { session: 'owner' });
  await offer(back, [], realHandlers({ plat: plat2 }));
  assert.equal(plat2.cards.length, 0, 'the owner finds it already posted, by someone else');
});

test('GAP C-two-hosts-one-item: an owner and another host restored together both post the same card (an effect runs twice)', async () => {
  const root = fresh();
  const owner = open(root, { session: 'owner' });
  await offer(owner, [start('owner')], realHandlers({ hearth: false, actors: agentActors() }));
  // Both hosts restore before either has run the pending card.
  const a = open(root, { session: 'owner' });
  const b = open(root, { session: 'other' });
  const plat = thread();
  await offer(a, [], realHandlers({ plat }));
  await offer(b, [], realHandlers({ plat }));
  assert.equal(plat.cards.filter((c) => c.key.endsWith(':ask') || /ask/.test(c.key)).length, 2, 'the same ask effect posted a card twice');
  assert.equal(new Set(plat.cards.map((c) => c.key)).size, 1, 'both under the same effect id');
});
