// The intake workflow (plan item wf-intake): a request is shaped into an issue, challenged, revised at most twice,
// and the frozen issue starts a quick-fix child item. Real engine, real accept, real host; agents and GitHub stubbed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, BRIEFS, builds, verifies, suiteWake, tapWake, offer, pending } from './tourney/world.js';
import { loadWorkflow } from '../src/index.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDir } from '../src/actors.js';

const REQUEST = { url: 'https://github.com/o/r/issues/9', text: 'average([]) gives NaN; an empty list should average to 0.' };
const shaped = (n = 1) => ({
  title: `average of an empty list (round ${n})`,
  problem: 'average([]) returns NaN.',
  reason: 'NaN reached an invoice total.',
  outcome: 'average([]) is 0, with a test.',
  expect: ['average([]) returns 0', ...(n > 1 ? [`a regression test calls average([]) (round ${n})`] : [])],
  proofs: [{ line: 'average([]) returns 0', proof: 'run', how: 'node -e' }, ...(n > 1 ? [{ line: `a regression test calls average([]) (round ${n})`, proof: 'run', how: 'npm test' }] : [])],
  non_goals: ['non-numeric entries'],
  assumptions: ['0, not null, for an empty list']
});
const verdictOn = (issue, result) => ({ result, lines: issue.expect.map((line) => ({ line, result, evidence: `${result}: tried a wrong build` })), wrong_build: 'none found' });
const shapes = (n) => () => ({ issue: shaped(n) });
const challenges = (result) => ({ input }) => verdictOn(input.issue, result);

const childOf = (w, item) => {
  const run = pending(w.host(item)).runs.find((r) => r.invoke === 'fix');
  return run && run.id;
};

test('intake loads through the load check, with shape and challenge as its stages and quick-fix as a child', () => {
  const spec = loadWorkflow('intake');
  assert.match(spec.id, /^intake@[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(spec.meta.actors).filter((a) => spec.meta.actors[a].rules), ['shape', 'challenge']);
  assert.equal(spec.states.fixing.invoke.src, 'quick-fix');
});

test('a PASS challenge freezes the issue: the quick-fix child starts with it, url from the request, new fields passed through', async () => {
  const w = await makeWorld();
  try {
    await w.start('in1', 'intake', { request: REQUEST });
    assert.equal(w.host('in1').snapshot.value, 'shaping');
    assert.ok((await w.agent('in1', 'shape', shapes(1))).accepted);
    await w.drive('in1');
    assert.equal(w.host('in1').snapshot.value, 'challenging');
    const ch = w.openRun('in1', 'challenge');
    assert.deepEqual(Object.keys(ch.input).sort(), ['issue', 'request', 'task']);
    assert.equal(ch.input.issue.url, REQUEST.url, 'the host set the url from the request');
    assert.ok((await w.agent('in1', 'challenge', challenges('PASS'))).accepted);
    await w.drive('in1');
    const h = w.host('in1');
    assert.equal(h.snapshot.value, 'fixing');
    const child = childOf(w, 'in1');
    const frozen = { ...shaped(1), url: REQUEST.url };
    assert.deepEqual(h.snapshot.context.issue, frozen);
    assert.deepEqual(w.host(child).snapshot.context.issue, frozen, 'the child item starts from the frozen issue');
    const brief = w.openRun(child, 'brief');
    assert.deepEqual(brief.input.issue, frozen, "the child's brief gets every new field");
    // The child runs to merged; intake ends done with its output.
    assert.ok((await w.agent(child, 'brief', () => BRIEFS)).accepted);
    await w.drive('in1');
    assert.ok((await w.agent(child, 'build', builds(w, 1, { green: false }))).accepted);
    await w.drive('in1');
    const head = w.gh.state[1].head;
    w.gh.green(head);
    await w.drive('in1', suiteWake(head, 1));
    assert.ok((await w.agent(child, 'verify', verifies(w, 'PASS'))).accepted);
    await w.drive('in1');
    await w.drive('in1', tapWake(w.cardOf(child), 0));
    assert.equal(w.host(child).snapshot.value, 'done');
    const end = w.host('in1').snapshot;
    assert.equal(end.value, 'done');
    assert.equal(end.output.fix.merge.sha, w.gh.state[1].mergeSha);
    assert.deepEqual(end.output.issue, frozen);
  } finally {
    await w.close();
  }
});

test('a FAIL challenge reshapes with the challenge as input, twice; the third FAIL puts up the card', async () => {
  const w = await makeWorld();
  try {
    await w.start('in2', 'intake', { request: REQUEST });
    for (let n = 1; n <= 3; n++) {
      const shape = w.openRun('in2', 'shape');
      if (n === 1) assert.equal(shape.input.challenge, null);
      else assert.equal(shape.input.challenge.result, 'FAIL', `round ${n} gets the last challenge`);
      assert.ok((await w.agent('in2', 'shape', shapes(n))).accepted);
      await w.drive('in2');
      assert.ok((await w.agent('in2', 'challenge', challenges('FAIL'))).accepted);
      await w.drive('in2');
    }
    const h = w.host('in2');
    assert.equal(h.snapshot.value, 'stuck');
    assert.equal(w.rows('in2').filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'shape' && r.payload.phase === 'start').length, 3);
    assert.equal(w.plat.cards.length, 1);
    // revise needs words: they reach shape as its answer, for one more round.
    const ask = pending(h).runs.find((r) => r.actor === 'ask');
    await offer(h, [{ event: { type: `xstate.done.actor.${ask.invoke}`, output: { choice: 'revise', by: 'person', why: 'treat an empty list as 0' } }, run: ask.id, source: { system: 'hearth', ref: 'typed' } }], w.handlersFor(h));
    assert.equal(w.host('in2').snapshot.value, 'shaping');
    assert.deepEqual(w.openRun('in2', 'shape').input.answer, { choice: 'revise', by: 'person', why: 'treat an empty list as 0' });
    assert.ok((await w.agent('in2', 'shape', shapes(4))).accepted);
    await w.drive('in2');
    assert.ok((await w.agent('in2', 'challenge', challenges('FAIL'))).accepted);
    await w.drive('in2');
    assert.equal(w.host('in2').snapshot.value, 'stuck', 'one round per answer');
  } finally {
    await w.close();
  }
});

test('the card: build as is starts the child with the last issue; drop ends dropped; a blocked shape reaches it with no issue', async () => {
  const w = await makeWorld();
  try {
    await w.start('in3', 'intake', { request: REQUEST });
    for (let n = 1; n <= 3; n++) {
      assert.ok((await w.agent('in3', 'shape', shapes(n))).accepted);
      await w.drive('in3');
      assert.ok((await w.agent('in3', 'challenge', challenges('FAIL'))).accepted);
      await w.drive('in3');
    }
    await w.drive('in3', tapWake(w.cardOf('in3'), 1)); // build as is
    assert.equal(w.host('in3').snapshot.value, 'fixing');
    assert.deepEqual(w.host(childOf(w, 'in3')).snapshot.context.issue, { ...shaped(3), url: REQUEST.url });

    await w.start('in4', 'intake', { request: REQUEST });
    assert.ok((await w.agent('in4', 'shape', () => ({ blocked: { reason: 'a question, not a change' } }))).accepted);
    await w.drive('in4');
    let h = w.host('in4');
    assert.equal(h.snapshot.value, 'stuck');
    assert.equal(h.snapshot.context.issue, null);
    await w.drive('in4', tapWake(w.cardOf('in4'), 1)); // build as is, with no issue: refused, still waiting
    assert.equal(w.host('in4').snapshot.value, 'stuck');
    h = w.host('in4');
    const ask = pending(h).runs.find((r) => r.actor === 'ask');
    assert.ok(ask, 'the ask run is still open after the refused answer');
    await offer(h, [{ event: { type: `xstate.done.actor.${ask.invoke}`, output: { choice: 'drop', by: 'person' } }, run: ask.id, source: { system: 'hearth', ref: 'typed' } }], w.handlersFor(h));
    h = w.host('in4');
    assert.equal(h.snapshot.value, 'dropped');
    assert.equal(childOf(w, 'in4') ?? null, null);
  } finally {
    await w.close();
  }
});

test('the challenge is held to the expect lines at accept, and its prompt holds only the request and the issue', async () => {
  const w = await makeWorld();
  try {
    await w.start('in5', 'intake', { request: REQUEST });
    assert.ok((await w.agent('in5', 'shape', shapes(2))).accepted);
    await w.drive('in5');
    const run = w.openRun('in5', 'challenge');
    const issue = run.input.issue;
    const bad = [
      { ...verdictOn(issue, 'PASS'), lines: verdictOn(issue, 'PASS').lines.slice(1) },
      { ...verdictOn(issue, 'PASS'), lines: [...verdictOn(issue, 'PASS').lines].reverse() },
      { ...verdictOn(issue, 'PASS'), lines: [...verdictOn(issue, 'PASS').lines, { line: 'extra', result: 'PASS', evidence: 'x' }] },
      { ...verdictOn(issue, 'PASS'), lines: verdictOn(issue, 'PASS').lines.map((l, i) => (i ? { ...l, result: 'FAIL' } : l)) }
    ];
    for (const [i, result] of bad.entries()) {
      const got = await w.agent('in5', 'challenge', () => result, `bad-${i}`);
      assert.ok(got.refused, `bad result ${i} is refused: ${JSON.stringify(got)}`);
    }
    const prompt = readFileSync(join(runDir(w.root, run.id), 'brief.md'), 'utf8');
    assert.ok(prompt.includes(REQUEST.text));
    assert.ok(!prompt.includes('"challenge"') && !prompt.includes('"answer"'), 'no shape input reaches the challenger');
  } finally {
    await w.close();
  }
});
