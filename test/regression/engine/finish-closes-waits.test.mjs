// Expect: fix-finish-closes-waits/left-closes, fix-finish-closes-waits/nothing-else-held
// A quick-fix item driven by the real effect handlers over a thread that records every card, close and post: an item
// moved on from its merge card has the card closed once by its key, no stop pending and no ask open, and a closed PR ends
// in closedOutside; a stop with nothing to close closes nothing, and a tap on a closed card moves nothing.
import { handlers } from '../../../packages/engine/src/effects/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inputsOfWake } from '../../../packages/engine/src/wake.js';
import { A, B, agentActors, fresh, open, offer, pending, start, rowsOf } from '../lib.mjs';

/** A thread that records cards, closes and posts. `hold(effect)` true keeps a card from being made (ready false). */
function recordingThread({ hold = null } = {}) {
  const cards = [];
  const closes = [];
  const posts = [];
  let n = 0;
  const made = new Map();
  const hearth = {
    card: async ({ key, question, choices }) => {
      const ref = `cmsg_${++n}`;
      made.set(key, ref);
      cards.push({ key, ref, question, choices });
      return { ref };
    },
    post: async ({ key, text }) => {
      posts.push({ key, text });
      return { ref: `cmsg_${++n}` };
    },
    close: async ({ key }) => {
      const ref = made.get(key) ?? null;
      closes.push({ key, ref });
      return ref ? { ref } : null;
    },
    ...(hold && { ready: (effect) => effect.type === 'stop' || !hold(effect) })
  };
  return { cards, closes, posts, hearth, clock: { wakeAt: async ({ key }) => ({ ref: `wake ${key}` }) } };
}


/** A quick-fix item driven by the real handlers. Merges are counted and never reached GitHub. */
async function item({ verify, hold } = {}) {
  const root = fresh();
  const host = open(root);
  const thread = recordingThread({ hold });
  const merges = [];
  const effects = handlers({
    hearth: thread.hearth,
    clock: thread.clock,
    actors: { ...agentActors(verify ? { verify } : {}), merge: { start: async (e) => { merges.push(e); return { output: { sha: 'd'.repeat(40) } }; } } }
  });
  await offer(host, [start()], effects);
  return { root, host, thread, effects, merges };
}

const PUSH = (sha) => ({ event: { type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' }, source: { system: 'github', ref: `push-${sha.slice(0, 4)}` } });
const RED = (sha) => ({ event: { type: 'github.check_run.completed', check: 'test', conclusion: 'failure', head_sha: sha, pr: 'o/r#1', details_url: 'https://x/1' }, source: { system: 'github', ref: 'red-1' } });
const CLOSED = (outcome) => ({ event: { type: 'github.pull_request.closed', outcome, pr: 'o/r#1' }, source: { system: 'github', ref: `closed-${outcome}` } });

const tapWake = (cardRef, index = 0) => `<wake reason="decision-chosen" current-time="2026-11-04T21:00:00Z">
  <project id="chan_x" type="project"><thread ts="cmsg_t"><message trigger="true" from="human" trust="principal" author-id="user_x">Chose</message></thread></project>
  <system-note>decision_id=${cardRef}</system-note>
  <system-note>option=A</system-note>
  <system-note>option_index=${index}</system-note>
  <system-note>actor_account_id=user_x</system-note>
</wake>`;

const stopsPending = (host) => pending(host).effects.filter((e) => e.type === 'stop');
const asksOpen = (host) => pending(host).runs.filter((r) => r.actor === 'ask');

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
