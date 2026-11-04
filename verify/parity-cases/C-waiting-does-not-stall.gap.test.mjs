// Verifier's characterisation of a GAP: C-waiting-does-not-stall is NOT met on the engine at the head (gaps.json, given
// to fix-waiting-wake). The case: given one item waiting on a person's card, then another independent item still
// advances, AND a wake is scheduled for the waiting one. The first half holds; the second does not: no wake is
// scheduled for an item waiting on a card. Asserted as today's behaviour. Re-characterised for the stage contract
// (engine-stage-contract): quick-fix sets no timer at all now (lane A removed buildTimeout), so no wake is asked for
// in any state; the scheduling machinery is shown on the engine's timed fixture workflow instead.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE, fresh, offer, open, pending, start } from './lib.mjs';
import { realHandlers, thread } from './gaps-lib.mjs';
import { restore, loadWorkflow } from '../../packages/engine/src/index.js';

test('GAP C-waiting-does-not-stall: another item advances, but no wake is scheduled for the one waiting on its card', async () => {
  const root = fresh();
  const plat = thread();
  const waiting = open(root, { item: 'it-wait' });
  await offer(waiting, [start()], realHandlers({ plat }));
  assert.equal(waiting.snapshot.value, 'awaitingMerge');
  assert.equal(plat.cards.length, 1, 'it is waiting on a person card');

  // The first half of the case holds: an independent item advances meanwhile.
  const other = open(root, { item: 'it-other' });
  await offer(other, [start('owner', { issue: { ...ISSUE, url: 'https://github.com/o/r/issues/8' } })], realHandlers({ plat }));
  assert.equal(other.snapshot.value, 'awaitingMerge');

  // The second half does not: nothing schedules a wake for the waiting item.
  assert.equal(pending(waiting).timers.length, 0, 'the waiting item has no timer');
  assert.deepEqual(plat.wakes, [], 'no wake was asked for, in the waiting state or any other');
});

test('GAP C-waiting-does-not-stall (contrast): a state with a delay does ask the clock, so the scheduling machinery exists', async () => {
  const root = fresh();
  const plat = thread();
  const timed = loadWorkflow('timed', { dir: new URL('../../packages/engine/test/fixtures/workflows/', import.meta.url).pathname });
  const host = restore({ root, item: 'it-t', spec: timed, session: 'owner', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { pr: 'https://github.com/o/r/pull/1' } }, source: { system: 'claude-code', ref: 'owner' } }], realHandlers({ plat }));
  assert.equal(host.snapshot.value, 'waiting');
  assert.equal(plat.wakes.length, 1);
});
