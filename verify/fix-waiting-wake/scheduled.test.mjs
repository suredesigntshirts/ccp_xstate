// Expect id `scheduled` (fix-waiting-wake). Every asking state, entered through the real engine and effect handlers,
// asks the recording clock for exactly one wake keyed by its timer effect id and due one hour after the transition
// that entered it; an independent item still advances to its own card; leaving the state by a tap or a push asks the
// clock to drop that key and leaves no timer open.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGitHub } from '../../packages/engine/test/parity/world.js';
import { HOUR, A, B, ISSUE, PR, VERDICT, PUSH, fresh, open, start, world, agents, handlersOf, offer, pending, inputsOfWake, tapWake, entered, rowsOf, shift } from './lib.mjs';

const BRIEFS = { builder: 'b.md', verifier: 'v.md' };
const PLAN_R = { questions: ['q1?', 'q2?', 'q3?'], researcher: 'r', writer: 'w', verifier: 'v' };
const SRC = [{ url: 'https://example.org/a', at: 'quote' }];

/** The one wake this item asked for, checked against the transition that entered `state`. */
function checkOneWake(w, root, item, host, state) {
  const mine = w.wakes.filter((x) => x.key.startsWith(`${item}:`));
  assert.equal(mine.length, 1, `${item}: exactly one wake asked for in ${state}`);
  const row = entered(root, item, state);
  assert.ok(row, `${item} entered ${state}`);
  const [wake] = mine;
  const timers = pending(host).timers;
  assert.equal(timers.length, 1, 'one open timer');
  assert.equal(wake.key, timers[0].id, 'keyed by the timer effect id');
  assert.match(wake.key, new RegExp(`^${item}:${row.payload.seq}\\.xstate\\.after\\.checkBack\\..*\\.${state}$`), 'key is <item>:<seq>.<timer id> of this state');
  assert.equal(Date.parse(wake.due) - Date.parse(row.at), HOUR, 'due one hour after the entering transition');
  assert.equal(timers[0].due, wake.due);
  // The timer effect's rows: start then done, under the entering transition.
  const eff = rowsOf(root, item).filter((r) => r.kind === 'engine.effect' && r.payload.effect === wake.key);
  assert.deepEqual(eff.map((r) => r.payload.phase), ['start', 'done']);
  assert.equal(eff[0].payload.transition, row.id);
  assert.ok(w.cards.some((c) => c.key.startsWith(`${item}:${row.payload.seq}.`) && !c.closed), 'its card is up');
  return wake;
}

test('scheduled: quick-fix awaitingMerge asks for one wake while an independent item advances to its own card', async () => {
  const root = fresh();
  const w = world();
  const one = open(root, 'it-1');
  await offer(one, [start()], handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) })));
  assert.equal(one.snapshot.value, 'awaitingMerge');
  const wake = checkOneWake(w, root, 'it-1', one, 'awaitingMerge');
  // The independent item, beside it in the same journal, advances on its own (briefing -> ... -> its own card).
  const two = open(root, 'it-2');
  await offer(two, [start('owner', { issue: { ...ISSUE, url: 'https://github.com/o/r/issues/8' } })], handlersOf(w, agents({ brief: BRIEFS, build: PR(B), verify: VERDICT(B) })));
  assert.equal(two.snapshot.value, 'awaitingMerge');
  assert.equal(w.cards.filter((c) => c.key.startsWith('it-2:')).length, 1, 'it-2 has its own card');
  assert.equal(w.wakes.filter((x) => x.key.startsWith('it-1:')).length, 1, 'it-1 still one wake');
  assert.equal(one.snapshot.value, 'awaitingMerge', 'it-1 untouched');
  assert.deepEqual(w.drops, []);
  assert.ok(wake);
});

test('scheduled: quick-fix awaitingGates (PASS on a PR changing CI config)', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'g-1');
  await offer(h, [start()], handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A, { gates: ['.github/workflows/ci.yml'] }) })));
  assert.equal(h.snapshot.value, 'awaitingGates');
  checkOneWake(w, root, 'g-1', h, 'awaitingGates');
});

for (const [workflow, input] of [['quick-fix', { issue: ISSUE }], ['feature', { issue: ISSUE, branch: 'feature/x' }], ['research', { issue: ISSUE }]]) {
  test(`scheduled: ${workflow} replanning (the brief run failed)`, async () => {
    const root = fresh();
    const w = world();
    const h = open(root, `rp-${workflow}`, workflow);
    await offer(h, [start('owner', input)], handlersOf(w, agents({ brief: new Error('brief agent failed') })));
    assert.equal(h.snapshot.value, 'replanning');
    checkOneWake(w, root, `rp-${workflow}`, h, 'replanning');
  });
}

test('scheduled: research awaitingPublish (a PASS on the draft)', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'pub-1', 'research');
  const ans = { text: 'a', sources: SRC };
  await offer(h, [start()], handlersOf(w, agents({
    brief: PLAN_R, researcher: [ans, ans, ans], write: { text: 'draft', sources: SRC },
    verify: { result: 'PASS', issue: ISSUE, lines: [{ line: 'x works', result: 'PASS', evidence: 'e' }], sources: SRC }
  })));
  assert.equal(h.snapshot.value, 'awaitingPublish');
  checkOneWake(w, root, 'pub-1', h, 'awaitingPublish');
});

test('scheduled: leaving awaitingMerge by a tap drops the key and leaves no timer open (merging, then done)', async () => {
  const root = fresh();
  const w = world();
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const h = open(root, 'tap-1');
    const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }), gh.client);
    await offer(h, [start()], hs);
    const wake = checkOneWake(w, root, 'tap-1', h, 'awaitingMerge');
    const card = w.cards.find((c) => c.key.startsWith('tap-1:')).ref;
    await offer(h, inputsOfWake(h, tapWake(card, 0), { now: shift(wake.due, -60000) }), hs);
    assert.equal(h.snapshot.value, 'done');
    assert.deepEqual(w.drops, [wake.key], 'the clock was asked to drop exactly that key');
    assert.deepEqual(pending(h).timers, []);
    const cancel = rowsOf(root, 'tap-1').filter((r) => r.kind === 'engine.effect' && r.payload.type === 'cancel');
    assert.deepEqual(cancel.map((r) => r.payload.phase), ['start', 'done']);
    assert.equal(w.wakes.length, 1, 'no new wake asked for in merging or done');
    assert.equal(gh.merges.length, 1);
  } finally {
    await gh.close();
  }
});

test('scheduled: leaving awaitingMerge by a push (fresh item) drops the key and leaves no timer open', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'push-1');
  const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }));
  await offer(h, [start()], hs);
  const wake = checkOneWake(w, root, 'push-1', h, 'awaitingMerge');
  await offer(h, [{ event: PUSH(B), source: { system: 'github', ref: 'push b' } }], hs);
  assert.equal(h.snapshot.value, 'verifying');
  assert.deepEqual(w.drops, [wake.key]);
  assert.deepEqual(pending(h).timers, []);
  assert.equal(w.wakes.length, 1, 'verifying sets no timer');
  assert.ok(w.cards.find((c) => c.key.startsWith('push-1:')).closed, 'the card was closed too');
});
