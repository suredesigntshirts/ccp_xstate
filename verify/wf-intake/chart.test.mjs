// Verifier's own test for wf-intake Expect `chart`: workflows/intake.json loads through the engine's load check, and
// driven through the real host with stub agents every route the line names holds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkflow } from '../../packages/engine/src/index.js';
import { world, ISSUE, VERDICT, REQUEST, tmp } from './lib.mjs';

const pass = (run) => VERDICT(run.input.issue, 'PASS');
const fail = (tag) => (run) => VERDICT(run.input.issue, 'FAIL', tag);

test('intake.json loads through the engine load check (checkStages), with stages shape and challenge', () => {
  const spec = loadWorkflow('intake', { root: tmp('load') });
  assert.match(spec.id, /^intake@[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(spec.states).sort(), ['challenging', 'done', 'dropped', 'fixing', 'shaping', 'stuck']);
  assert.equal(spec.states.fixing.invoke.src, 'quick-fix');
  // the stage files are composed in: their rules reach the loaded spec
  assert.match(JSON.stringify(spec.meta.actors.shape), /You are the issue writer/);
  assert.match(JSON.stringify(spec.meta.actors.challenge), /You are the challenger/);
});

test('a start without request.url or request.text is refused', async () => {
  for (const input of [{}, { request: { text: 'x' } }, { request: { url: 'u' } }]) {
    const w = world();
    const res = await w.start(input);
    assert.notEqual(res[0].outcome, 'applied', JSON.stringify(input));
  }
});

test('shape then a PASS challenge starts one quick-fix child whose issue is shape\'s issue with url = request.url', async () => {
  const w = world();
  await w.start();
  assert.equal(w.state(), 'shaping');
  // shape writes no url, or a wrong one: the host sets it from the request either way
  await w.agent('shape', { issue: ISSUE(1, { url: 'https://example.com/wrong' }) });
  assert.equal(w.state(), 'challenging');
  await w.agent('challenge', pass);
  const kids = w.children();
  assert.equal(kids.length, 1, 'one child');
  const init = w.rows(kids[0]).find((r) => r.kind === 'engine.transition' && r.payload.seq === 0);
  assert.equal(init.payload.outcome, 'applied');
  assert.match(init.payload.workflow, /^quick-fix@/);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(1), url: REQUEST.url });
  // the child runs (stubs) to its end; the parent is not offered a second start
  assert.equal(w.status(kids[0]), 'done');
  await w.drive();
  assert.equal(w.children().length, 1, 'still one child after another drive');
});

test('the child\'s end ends intake done with the child\'s output', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { issue: ISSUE(1) });
  await w.agent('challenge', pass);
  const [kid] = w.children();
  const child = w.host(kid);
  assert.equal(child.snapshot.status, 'done');
  assert.equal(child.snapshot.value, 'done');
  const parent = w.host();
  assert.equal(parent.snapshot.value, 'done');
  assert.equal(parent.snapshot.status, 'done');
  assert.deepEqual(parent.snapshot.output.fix, child.snapshot.output);
  assert.equal(child.snapshot.output.merge.sha, 'd'.repeat(40));
  assert.deepEqual(parent.snapshot.output.issue, { ...ISSUE(1), url: REQUEST.url });
  assert.equal(parent.snapshot.output.challenge.result, 'PASS');
});

test('a FAIL reruns shape with that challenge as input, at most twice; the third FAIL puts a card up', async () => {
  const w = world();
  await w.start();
  for (let n = 1; n <= 3; n++) {
    assert.equal(w.state(), 'shaping', `round ${n}`);
    await w.agent('shape', { issue: ISSUE(n) });
    assert.equal(w.state(), 'challenging');
    await w.agent('challenge', fail(`round ${n}`));
  }
  assert.equal(w.state(), 'stuck');
  const shapes = w.runs('shape');
  const challenges = w.runs('challenge');
  assert.equal(shapes.length, 3);
  assert.equal(challenges.length, 3);
  assert.equal(shapes[0].input.challenge, null);
  // each revision's input is the challenge that failed the version before, exactly as returned
  for (const i of [1, 2]) {
    assert.deepEqual(shapes[i].input.challenge, VERDICT({ expect: ISSUE(i).expect }, 'FAIL', `round ${i}`));
    assert.deepEqual(shapes[i].input.request, REQUEST);
  }
  const cards = w.log.filter((e) => e.actor === 'ask');
  assert.equal(cards.length, 1, 'one card');
  assert.deepEqual(cards[0].input.choices, ['revise', 'build as is', 'drop']);
  assert.deepEqual(cards[0].input.challenge, VERDICT({ expect: ISSUE(3).expect }, 'FAIL', 'round 3'));
  assert.equal(w.children().length, 0, 'no child before the card is answered');
});

test('a FAIL then a PASS goes on to the child (a revision that holds is frozen)', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { issue: ISSUE(1) });
  await w.agent('challenge', fail('r1'));
  await w.agent('shape', { issue: ISSUE(2) });
  await w.agent('challenge', pass);
  assert.equal(w.children().length, 1);
  const init = w.rows(w.children()[0]).find((r) => r.payload.seq === 0);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(2), url: REQUEST.url });
});

async function toCard() {
  const w = world();
  await w.start();
  for (let n = 1; n <= 3; n++) {
    await w.agent('shape', { issue: ISSUE(n) });
    await w.agent('challenge', fail(`round ${n}`));
  }
  assert.equal(w.state(), 'stuck');
  return w;
}

test('card: revise with words reruns shape with the answer (one more round)', async () => {
  const w = await toCard();
  const answer = { choice: 'revise', by: 'person', why: 'round half to even, and cover the avg command too' };
  await w.tap(answer);
  assert.equal(w.state(), 'shaping');
  const shapes = w.runs('shape');
  assert.equal(shapes.length, 4);
  assert.deepEqual(shapes[3].input.answer, answer);
  // one more round: a FAIL now goes straight back to the card, a PASS to the child
  await w.agent('shape', { issue: ISSUE(4) });
  await w.agent('challenge', fail('round 4'));
  assert.equal(w.state(), 'stuck', 'after the revise round, a FAIL is the card again');
  await w.tap({ choice: 'revise', by: 'person', why: 'try again' });
  await w.agent('shape', { issue: ISSUE(5) });
  await w.agent('challenge', pass);
  assert.equal(w.children().length, 1);
});

test('card: revise with no words is not taken', async () => {
  const w = await toCard();
  const res = await w.tap({ choice: 'revise', by: 'person' });
  assert.notEqual(res[0].outcome, 'applied');
  assert.equal(w.state(), 'stuck');
  assert.equal(w.runs('shape').length, 3);
});

test('card: build as is starts the child with the last issue', async () => {
  const w = await toCard();
  await w.tap({ choice: 'build as is', by: 'stand-in' });
  const kids = w.children();
  assert.equal(kids.length, 1);
  const init = w.rows(kids[0]).find((r) => r.payload.seq === 0);
  assert.deepEqual(init.payload.event.input.issue, { ...ISSUE(3), url: REQUEST.url });
  assert.equal(w.host().snapshot.value, 'done');
});

test('card: drop ends the item dropped, with no child', async () => {
  const w = await toCard();
  await w.tap({ choice: 'drop', by: 'person' });
  const h = w.host();
  assert.equal(h.snapshot.value, 'dropped');
  assert.equal(h.snapshot.status, 'done');
  assert.equal(w.children().length, 0);
});

test('shape\'s blocked answer reaches the card (with its reason); build as is is then not taken (no issue)', async () => {
  const w = world();
  await w.start();
  await w.agent('shape', { blocked: { reason: 'this asks two unrelated things' } });
  assert.equal(w.state(), 'stuck');
  assert.equal(w.runs('challenge').length, 0);
  const card = w.log.filter((e) => e.actor === 'ask').at(-1);
  assert.match(String(card.input.failure), /two unrelated things/);
  const res = await w.tap({ choice: 'build as is', by: 'stand-in' });
  assert.notEqual(res[0].outcome, 'applied');
  assert.equal(w.children().length, 0);
  await w.tap({ choice: 'revise', by: 'person', why: 'just do the rounding' });
  assert.equal(w.state(), 'shaping');
  assert.equal(w.runs('shape')[1].input.answer.why, 'just do the rounding');
});
