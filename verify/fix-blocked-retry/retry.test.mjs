// Verifier tests for fix-blocked-retry: retry-route, no-second-retry, not-blocked-unchanged. Real engine over stub
// agents, a local origin, a stub GitHub and a card recorder (lib.mjs). Written from the item and the decision, not the
// builder's tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { world, BRIEFS, REASON, blocked, builds, verifies, redWake, lastError, prUrl } from './lib.mjs';
import { all } from './scenarios.mjs';
import { runDir } from '../../packages/engine/src/actors.js';
import { standinInput } from '../../packages/engine/src/standin.js';

const brief = (w) => w.agent('a', 'brief', () => BRIEFS);
const runsOf = (w, actor) => [...new Set(w.rows('a').filter((r) => r.kind === 'engine.effect' && r.payload.type === 'run' && r.payload.actor === actor).map((r) => r.payload.effect))];
const answers = (w) => w.rows('a').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && r.payload.event?.type === 'xstate.done.actor.ask');

async function toBlocked(w) {
  await w.start('a');
  await brief(w);
  const first = await w.agent('a', 'build', blocked());
  return first;
}

test('retry-route: a blocked first build reaches blocked; retry rebuilds with the same briefs and the block as failure; the PR then verifies and merges', async () => {
  const w = await world();
  try {
    const first = await toBlocked(w);
    assert.equal(w.state('a'), 'blocked');
    const err = lastError(w, 'a');
    assert.equal(err.error, `build blocked: ${REASON}`, "the error text is main's");
    assert.equal(err.blocked, REASON, 'the error event carries the block');
    const card = w.cards.at(-1);
    assert.deepEqual(card.choices, ['retry', 'replan', 'drop']);
    assert.equal(card.inputs.failure, `build blocked: ${REASON}`, "the card's input carries the block's text");
    const before = w.snap('a').context;
    assert.equal(before.built, null);

    await w.tap('a', 'retry');
    assert.equal(w.state('a'), 'building');
    const after = w.snap('a').context;
    assert.deepEqual(after.briefs, before.briefs, 'same briefs');
    assert.equal(after.why, before.why, 'why unchanged');
    assert.equal(after.why, null);
    assert.equal(after.failure, `build blocked: ${REASON}`, 'failure names the block');
    assert.equal(after.built, true, 'the retried build counts as the second');
    assert.deepEqual(runsOf(w, 'brief').length, 1, 'no brief run after the block');
    const retried = w.openRun('a', 'build');
    assert.notEqual(retried.id, first.id);
    assert.equal(retried.input.task, first.input.task, 'the retried build has the same builder brief');
    assert.equal(retried.input.failure, `build blocked: ${REASON}`, "the retried build's failure input names the block");
    const stage = JSON.parse(readFileSync(join(runDir(w.root, retried.id), 'run.json'), 'utf8'));
    assert.equal(stage.input?.failure ?? stage.inputs?.failure, `build blocked: ${REASON}`, "the run folder's input has the failure");
    // The answer row names retry and who chose it.
    const ans = answers(w).at(-1);
    assert.equal(ans.payload.event.output.choice, 'retry');
    assert.equal(ans.payload.event.output.by, 'user_person');

    await w.agent('a', 'build', builds(w));
    assert.equal(w.state('a'), 'verifying');
    await w.agent('a', 'verify', verifies('PASS'));
    assert.equal(w.state('a'), 'awaitingMerge');
    await w.tap('a', w.cards.at(-1).choices[0]);
    assert.equal(w.state('a'), 'done');
    assert.deepEqual(w.gh.merges.map((m) => m.pr), [1]);
    assert.equal(w.snap('a').context.pr.url, prUrl(1));
  } finally { await w.close(); }
});

test('retry-route: replan and drop on the blocked card do what replanning does; nothing retries without an answer', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    // No answer: driving again (and a due checkBack) moves nothing.
    await w.drive('a');
    await w.drive('a', '<wake reason="send-later" current-time="2999-01-01T00:00:00Z"></wake>');
    assert.equal(w.state('a'), 'blocked', 'only an answer retries');
    assert.equal(runsOf(w, 'build').length, 1);
    await w.tap('a', 'drop');
    assert.equal(w.state('a'), 'dropped');
  } finally { await w.close(); }
});

test('retry-route (note): a stand-in grant cannot answer the blocked card, which carries no PR', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    const host = w.host('a');
    const run = [...host.runs.values()].find((r) => r.actor === 'ask');
    const grants = [{ id: 'g1', workflow: 'quick-fix', ask: 'ask', choices: ['retry'], repos: ['o/r'], until: '2999-01-01T00:00:00Z' }];
    assert.throws(() => standinInput(host, { effect: run.id, choice: 'retry', by: 'standin', grants }), /repo \(none\) not granted/);
  } finally { await w.close(); }
});

test('no-second-retry: a retried build blocked again replans with replan and drop only', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', blocked('blocked again'));
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
    assert.equal(w.snap('a').context.failure, 'build blocked: blocked again');
  } finally { await w.close(); }
});

test('no-second-retry: a rebuild after a verify FAIL that is blocked replans', async () => {
  const w = await world();
  try {
    await w.start('a'); await brief(w);
    await w.agent('a', 'build', builds(w));
    await w.agent('a', 'verify', verifies('FAIL'));
    assert.equal(w.state('a'), 'building');
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
  } finally { await w.close(); }
});

test('no-second-retry: a rebuild after a red check that is blocked replans', async () => {
  const w = await world();
  try {
    await w.start('a'); await brief(w);
    await w.agent('a', 'build', builds(w, { green: false }));
    assert.equal(w.state('a'), 'checking');
    await w.drive('a', redWake(w.gh.prs[1].head));
    assert.equal(w.state('a'), 'building');
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
  } finally { await w.close(); }
});

test('no-second-retry: a retried build whose verify FAILs has no build left and replans', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', builds(w));
    await w.agent('a', 'verify', verifies('FAIL'));
    assert.equal(w.state('a'), 'replanning');
    assert.deepEqual(w.cards.at(-1).choices, ['replan', 'drop']);
    assert.equal(runsOf(w, 'build').length, 2);
  } finally { await w.close(); }
});

test('no-second-retry: a replan resets the count, so a fresh attempt may be retried once', async () => {
  const w = await world();
  try {
    await toBlocked(w);
    await w.tap('a', 'retry');
    await w.agent('a', 'build', blocked('again'));
    assert.equal(w.state('a'), 'replanning');
    // A replan needs a why; a tap carries none, so answer as the ask's done event through offer.
    const { offer } = await import('../../packages/engine/src/host.js');
    const host = w.host('a');
    const run = [...host.runs.values()].find((r) => r.actor === 'ask');
    await offer(host, [{ event: { type: 'xstate.done.actor.ask', output: { choice: 'replan', why: 'five whys', by: 'p' } }, run: run.id, source: { system: 'hearth', ref: w.cards.at(-1).ref } }], w.handlersFor(host));
    await w.drive('a');
    assert.equal(w.state('a'), 'briefing');
    await brief(w);
    await w.agent('a', 'build', blocked());
    assert.equal(w.state('a'), 'blocked', 'the new attempt\'s first build may be retried');
  } finally { await w.close(); }
});

test("not-blocked-unchanged: verify FAIL, red check, stopped agent and briefing error match main; a block's error text is main's", async () => {
  const file = new URL('./evidence/main-scenarios.json', import.meta.url);
  assert.ok(existsSync(file));
  const main = JSON.parse(readFileSync(file, 'utf8'));
  const head = await all();
  for (const name of ['verify-fail', 'red-check', 'build-stopped', 'brief-error']) assert.deepEqual(head[name], main[name], name);
  assert.deepEqual(head['blocked-text'].errors, main['blocked-text'].errors, 'the error text for a block is main\'s');
  assert.deepEqual(main['blocked-text'].states.at(-1), 'replanning');
  assert.deepEqual(head['blocked-text'].states.at(-1), 'blocked');
});
