// Expect: fix-other-host-runs-effects/no-effects
// Case C-two-hosts-one-item: an item owned by session A with its card open; session B's host, offered a wake and
// nothing, starts no effect, leaves the item file as it was and journals its refusals in B's own session file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handlers } from '../../../packages/engine/src/effects/index.js';
import { itemFile, sessionFile } from '../../../packages/engine/src/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { A, agentActors, askRun, checkWake, fresh, inputsOfWake, offer, open, pending, start } from '../lib.mjs';

const sessionRowsOf = (root, session) => readFile(sessionFile(root, session)).rows;
/** The thread and clock as the host's effects reach them; everything asked for is kept. */
function thread() {
  const cards = [];
  const wakes = [];
  let n = 0;
  return {
    cards,
    wakes,
    hearth: { card: async ({ key, question, choices }) => { cards.push({ key, question, choices }); return { ref: `cmsg_${++n}` }; }, post: async ({ key, text }) => ({ ref: `cmsg_${++n}` }) },
    clock: { wakeAt: async ({ key, due }) => { wakes.push({ key, due }); return { ref: `wake ${key}` }; } }
  };
}
const realHandlers = ({ plat = thread(), actors = agentActors(), hearth = true } = {}) =>
  handlers({ hearth: hearth ? plat.hearth : null, clock: plat.clock, actors });

const counting = (inner) => {
  const starts = [];
  const wrap = (type) => ({
    handles: () => true,
    find: async () => undefined,
    start: async (effect) => { starts.push({ type, id: effect.id }); return inner[type]?.start ? inner[type].start(effect) : {}; }
  });
  return { starts, handlers: { run: wrap('run'), stop: wrap('stop'), timer: wrap('timer'), cancel: wrap('cancel') } };
};

test('a host of another session starts nothing and leaves the item file alone; the owner then runs the card once', async () => {
  const root = fresh();
  // Session A starts the item with real handlers and no thread: the card (ask) stays open.
  const hostA = open(root, { session: 'session-A' });
  await offer(hostA, [start('session-A')], realHandlers({ hearth: false }));
  assert.equal(hostA.snapshot.value, 'awaitingMerge');
  const card = askRun(hostA);
  assert.ok(card, 'the ask run is open');
  assert.equal(pending(hostA).effects.some((e) => e.id === card.id), true, 'the card effect is not yet started');
  const file = itemFile(root, 'it-1');
  const before = readFileSync(file);

  // Session B's host, restored from the file: a wake, then nothing, with handlers that would run anything.
  const hostB = open(root, { session: 'session-B' });
  assert.equal(hostB.owner, 'session-A');
  const c = counting(handlers({ hearth: thread().hearth, clock: thread().clock, actors: agentActors() }));
  const wake = checkWake({ head: A });
  const first = await offer(hostB, inputsOfWake(hostB, wake), c.handlers);
  const empty = await offer(hostB, [], c.handlers);
  const again = await offer(open(root, { session: 'session-B' }), [], c.handlers);
  assert.ok(first.length >= 1 && first.every((r) => r.outcome === 'not-owner'), JSON.stringify(first.map((r) => r.outcome)));
  assert.deepEqual(empty, []);
  assert.deepEqual(again, []);
  assert.deepEqual(c.starts, [], 'no run, stop, timer or cancel started by B');
  assert.ok(readFileSync(file).equals(before), 'the item file is byte-identical');
  const rowsB = sessionRowsOf(root, 'session-B');
  assert.ok(rowsB.length >= 1 && rowsB.every((r) => r.kind === 'engine.transition' && r.payload.outcome === 'not-owner'));
  assert.ok(sessionFile(root, 'session-B'));

  // The owner's host runs the open card, once, even after B woke first.
  const plat = thread();
  const ownerHandlers = realHandlers({ plat });
  const hostA2 = open(root, { session: 'session-A' });
  await offer(hostA2, [], ownerHandlers);
  await offer(open(root, { session: 'session-A' }), [], ownerHandlers);
  assert.equal(plat.cards.length, 1, 'the card went up once');
  const effectRows = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.kind === 'engine.effect' && r.payload.effect === card.id);
  assert.deepEqual(effectRows.map((r) => r.payload.phase), ['start', 'done']);
  assert.ok(effectRows.every((r) => r.session === 'session-A'));
});
