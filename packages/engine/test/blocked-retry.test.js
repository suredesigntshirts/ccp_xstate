// Plan item fix-blocked-retry (plan/decisions/2026-11-05-blocked-retry.md): a first build that returns blocked stops at
// a card of its own whose choices are retry, replan and drop. Retry builds again with the same briefs and the block as
// failure, and counts as the attempt's second build. Every other error, and a block on any later build, still goes to
// replanning with replan and drop only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, B, BRIEFS, done, failedWith, machine, path, pr, pushed, run, starts, verdict, workflow } from './flow.js';

const REASON = 'push refused: the token lacks the workflow scope; grant it or push commit c7908f4';
// The error event resultsOf() makes from a blocked build result: today's text, plus the reason as blocked.
const blockedBuild = (reason = REASON) => ({ ...failedWith('build', `build blocked: ${reason}`), blocked: reason });
const retry = done('ask', { choice: 'retry', by: 'stand-in' });
const toBlocked = [done('brief', BRIEFS), blockedBuild()];

test('blocked-retry: a blocked first build goes to blocked, whose card offers retry, replan and drop with the block', () => {
  assert.deepEqual(path(toBlocked), ['briefing', 'building', 'blocked']);
  const s = run(toBlocked);
  assert.equal(s.context.failure, `build blocked: ${REASON}`);
  assert.deepEqual(starts(run(toBlocked.slice(0, 1)), toBlocked[1]), ['ask']);
  const ask = workflow.states.blocked.invoke;
  assert.deepEqual(ask.input.choices, { value: ['retry', 'replan', 'drop'] });
  assert.equal(ask.input.failure, 'context.failure');
  assert.equal(ask.id, 'ask', 'a grant names the card as every other card');
  assert.ok(workflow.states.blocked.after?.checkBack, 'the card has the check-back timer');
});

test('blocked-retry: retry builds again with the same briefs, the block as failure, no why and no brief run', () => {
  const before = run(toBlocked);
  const after = run([...toBlocked, retry]);
  assert.equal(after.value, 'building');
  assert.deepEqual(after.context.briefs, BRIEFS);
  assert.equal(after.context.failure, `build blocked: ${REASON}`);
  assert.equal(after.context.why, before.context.why);
  assert.deepEqual([after.context.built, after.context.rebuilt], [true, null]);
  assert.deepEqual(starts(before, retry), ['build'], 'only a build starts');
});

test('blocked-retry: the retried build counts as the second: its PR verifies and merges, and a FAIL after it replans', () => {
  const retried = [...toBlocked, retry, done('build', pr(A))];
  assert.equal(run(retried).value, 'verifying');
  assert.deepEqual([run(retried).context.built, run(retried).context.rebuilt], [true, true]);
  assert.equal(run([...retried, done('verify', verdict('PASS', A))]).value, 'awaitingMerge');
  assert.equal(run([...retried, done('verify', verdict('FAIL', A))]).value, 'replanning');
});

test('blocked-retry: a retried build blocked again, or a rebuild blocked, goes to replanning with replan and drop only', () => {
  assert.equal(run([...toBlocked, retry, blockedBuild('still refused')]).value, 'replanning');
  const rebuild = [done('brief', BRIEFS), done('build', pr(A)), done('verify', verdict('FAIL', A))];
  assert.equal(run(rebuild).value, 'building');
  assert.equal(run([...rebuild, blockedBuild()]).value, 'replanning');
  const red = [done('brief', BRIEFS), done('build', pr(A, { green: false })), { type: 'github.check_run.completed', check: 'test', conclusion: 'failure', head_sha: A, pr: 'o/r#1' }];
  assert.equal(run(red).value, 'building');
  assert.equal(run([...red, blockedBuild()]).value, 'replanning');
  assert.deepEqual(workflow.states.replanning.invoke.input.choices, { value: ['replan', 'drop'] });
});

test('blocked-retry: only a block reaches the card: a stop without a return and a brief error replan as before', () => {
  assert.equal(run([done('brief', BRIEFS), failedWith('build', 'the agent stopped without calling the return tool')]).value, 'replanning');
  assert.equal(run([failedWith('brief', 'x')]).value, 'replanning');
  // The blocked text alone, without the event's blocked field, is an ordinary error.
  assert.equal(run([done('brief', BRIEFS), failedWith('build', `build blocked: ${REASON}`)]).value, 'replanning');
});

test('blocked-retry: replan from the blocked card needs a why and briefs again; drop ends; nothing else is taken', () => {
  const s = run(toBlocked);
  assert.equal(machine.getTransitionData(s, done('ask', { choice: 'replan', by: 'p' })).length, 0);
  const again = run([...toBlocked, done('ask', { choice: 'replan', by: 'p', why: 'five whys' })]);
  assert.equal(again.value, 'briefing');
  assert.deepEqual([again.context.built, again.context.failure, again.context.why], [null, null, 'five whys']);
  assert.equal(run([...toBlocked, done('ask', { choice: 'drop', by: 'p' })]).value, 'dropped');
  assert.equal(machine.getTransitionData(s, done('ask', { choice: 'approve', by: 'p' })).length, 0);
  assert.equal(machine.getTransitionData(s, pushed(B)).length, 0, 'a push does not move a blocked item');
});
