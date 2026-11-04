// Expect nothing-else-held: a stopped agent run finishes its stop at once with nothing closed; a stop of an ask whose
// card was never made finishes with nothing closed; a tap on a closed card moves nothing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, item, offer, PUSH, stopsPending, asksOpen, tapWake, rowsOf, pending } from './lib.mjs';
import { inputsOfWake } from '../../packages/engine/src/wake.js';

test('nothing-else-held: a verify run left by a push stops at once with nothing closed', async () => {
  const it = await item({ verify: [] });
  assert.equal(it.host.snapshot.value, 'verifying');
  const verifyRun = pending(it.host).runs.find((r) => r.actor === 'verify');
  assert.ok(verifyRun, 'a verify run is open');
  await offer(it.host, [PUSH(B)], it.effects);
  const stop = it.host.effects.get(`${verifyRun.id}:stop`);
  assert.ok(stop, 'the left verify run has a stop effect');
  assert.equal(stop.effect.actor, 'verify', 'the stop names its actor');
  assert.equal(stop.phase, 'done');
  assert.deepEqual(stop.outcome, { closed: null });
  assert.equal(it.thread.closes.length, 0, 'the thread was asked to close nothing');
  assert.deepEqual(stopsPending(it.host), []);
});

test('nothing-else-held: the stop of an ask whose card was never made finishes with nothing closed', async () => {
  // The thread holds the card (ready false), so it is never made; then a push moves the item on.
  const it = await item({ hold: (e) => e.actor === 'ask' });
  assert.equal(it.host.snapshot.value, 'awaitingMerge');
  assert.equal(it.thread.cards.length, 0, 'no card was made');
  const ask = asksOpen(it.host)[0];
  assert.ok(ask);
  await offer(it.host, [PUSH(B)], it.effects);
  assert.equal(it.thread.cards.length, 0);
  assert.ok(it.thread.closes.every((c) => c.ref === null), `nothing was closed: ${JSON.stringify(it.thread.closes)}`);
  const stop = it.host.effects.get(`${ask.id}:stop`);
  assert.equal(stop?.phase, 'done', `the stop finished: ${JSON.stringify(stop)}`);
  assert.deepEqual(stop.outcome, { closed: null });
  assert.deepEqual(stopsPending(it.host), []);
  assert.ok(!pending(it.host).effects.some((e) => e.id === ask.id), 'the never-made card is not left pending');
});

test('nothing-else-held: a tap on the closed card moves nothing', async () => {
  const it = await item();
  const card = it.thread.cards[0];
  await offer(it.host, [PUSH(B)], it.effects);
  const state = it.host.snapshot.value;
  const before = rowsOf(it.root).length;
  const inputs = inputsOfWake(it.host, tapWake(card.ref, 0));
  assert.deepEqual(inputs, [], 'the tap matches no run');
  const results = await offer(it.host, inputs, it.effects);
  assert.equal(it.host.snapshot.value, state);
  assert.deepEqual(results.filter((r) => r.outcome === 'applied'), []);
  // A forged completion naming the stopped run is not applied either.
  const askId = card.key;
  const forged = await offer(it.host, [{ event: { type: `xstate.done.actor.${askId.split('.').pop()}`, output: { choice: 'merge', by: 'x' } }, run: askId, source: { system: 'hearth', ref: card.ref } }], it.effects);
  assert.ok(forged.every((r) => r.outcome !== 'applied'), JSON.stringify(forged));
  assert.equal(it.host.snapshot.value, state);
  assert.equal(it.merges.length, 0);
  assert.ok(rowsOf(it.root).length >= before);
});
