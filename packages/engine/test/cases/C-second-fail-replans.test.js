// C-second-fail-replans (plan/cases/work-item.md): a FAIL, a rebuild and a second FAIL send the item to
// replanning, which waits for a written five whys, and no third build starts. Ported to the stage contract: the build
// bound is the shift register built/rebuilt (inc is gone), and a replan answer without a why matches no candidate,
// so the host refuses it and the ask run stays open (reenter is gone; lane A, Q3 round 2).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, BRIEFS, done, machine, path, pr, run, starts, toVerifying, verdict } from '../flow.js';

const twoFails = [...toVerifying(A), done('verify', verdict('FAIL', A)), done('build', pr(B)), done('verify', verdict('FAIL', B))];

test('C-second-fail-replans: the first FAIL rebuilds, the second goes to replanning', () => {
  assert.deepEqual(path(twoFails).slice(1), ['building', 'verifying', 'building', 'verifying', 'replanning']);
  assert.deepEqual([run(twoFails).context.built, run(twoFails).context.rebuilt], [true, true]);
});

test('C-second-fail-replans: the second FAIL starts the replan question, not a build', () => {
  assert.deepEqual(starts(run(twoFails.slice(0, -1)), twoFails.at(-1)), ['ask']);
});

test('C-second-fail-replans: replan without a written why is not taken: the item stays replanning and starts no build', () => {
  const replanning = run(twoFails);
  const noWhy = done('ask', { choice: 'replan', by: 'p' });
  assert.equal(run([...twoFails, noWhy]).value, 'replanning');
  assert.deepEqual(starts(replanning, noWhy), [], 'no candidate takes it: the open ask run is not replaced, and no build starts');
  assert.equal(machine.getTransitionData(replanning, noWhy).length, 0, 'the event is not taken in replanning');
});

test('C-second-fail-replans: replan with a written why briefs again with the build bound reset', () => {
  const again = run([...twoFails, done('ask', { choice: 'replan', by: 'p', why: 'five whys: ...' })]);
  assert.equal(again.value, 'briefing');
  assert.deepEqual([again.context.built, again.context.rebuilt, again.context.verdict, again.context.why], [null, null, null, 'five whys: ...']);
  assert.equal(run([...twoFails, done('ask', { choice: 'replan', by: 'p', why: 'w' }), done('brief', BRIEFS)]).value, 'building');
});

test('C-second-fail-replans: drop ends the item', () => {
  assert.equal(run([...twoFails, done('ask', { choice: 'drop', by: 'p' })]).value, 'dropped');
});
