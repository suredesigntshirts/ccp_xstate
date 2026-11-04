// C-second-fail-replans (plan/cases/work-item.md): a FAIL, a rebuild and a second FAIL send the item to replanning,
// which waits for a written five whys, and no third build starts. Driven through the host; the person's taps are
// tap wakes on the cards the host put up in the stub thread. Ported to the stage contract: the build bound is the
// built/rebuilt shift register (inc is gone), and a replan tap without a why matches no candidate, so the host refuses
// it and the one replan card stays up (reenter is gone; lane A, Q3 round 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, BRIEFS, agents, cardOf, fresh, inputsOfWakeFor, offer, open, openRun, platform, pr, start, tapWake, verdict, world } from './world.js';

async function twoFails() {
  const root = fresh();
  const host = open(root);
  const plat = platform();
  const a = agents({ brief: [BRIEFS, BRIEFS], build: [pr(A), pr(B), pr(B)], verify: [verdict('FAIL', A), verdict('FAIL', B)] });
  const effects = world({ plat, actors: a.byActor });
  await offer(host, [start()], effects);
  return { root, host, plat, a, effects };
}

test('C-second-fail-replans: the second FAIL goes to replanning, asks for a replan, and starts no third build', async () => {
  const { host, plat, a } = await twoFails();
  assert.equal(host.snapshot.value, 'replanning');
  assert.equal(a.started.filter((e) => e.actor === 'build').length, 2);
  assert.deepEqual([host.snapshot.context.built, host.snapshot.context.rebuilt], [true, true]);
  assert.deepEqual(plat.cards.at(-1).choices, ['replan', 'drop']);
});

test('C-second-fail-replans: a tap on replan carries no written why, so it is refused, the card stays open and no build starts', async () => {
  const { host, plat, a, effects } = await twoFails();
  const card = cardOf(host, openRun(host, 'ask'));
  const [answered] = await offer(host, inputsOfWakeFor(host, tapWake(card, 0, 'A')), effects);
  assert.equal(answered.outcome, 'refused');
  assert.match(answered.row.payload.reason, /is not taken in "replanning"/);
  assert.equal(host.snapshot.value, 'replanning');
  assert.equal(plat.cards.length, 1, 'the one replan card is still the open question');
  assert.equal(cardOf(host, openRun(host, 'ask')), card);
  assert.equal(a.started.filter((e) => e.actor === 'build').length, 2);
});

test('C-second-fail-replans: a replan with a written why briefs again, with the build bound reset', async () => {
  const { host, a, effects } = await twoFails();
  const run = openRun(host, 'ask');
  const answer = { event: { type: 'xstate.done.actor.ask', output: { choice: 'replan', by: 'person', why: 'five whys: ...' } }, run: run.id, source: { system: 'hearth', ref: cardOf(host, run) } };
  await offer(host, [answer], effects);
  assert.deepEqual([host.snapshot.context.built, host.snapshot.context.rebuilt, host.snapshot.context.why], [true, null, 'five whys: ...'], 'one build since the replan');
  assert.equal(host.snapshot.value, 'verifying', 'briefed again and built once more');
  assert.equal(a.started.filter((e) => e.actor === 'brief').length, 2);
});
