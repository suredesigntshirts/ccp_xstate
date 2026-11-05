// Verifier's own test for wf-intake Expect `independent`: the challenge run's prompt holds the request and the issue
// and none of shape's other output (nor the earlier challenge or the card's answer); accept() refuses a challenge
// result whose lines skip, add, reorder or contradict the issue's expect lines, or whose result disagrees with them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { world, ISSUE, VERDICT, REQUEST, read, runDir } from './lib.mjs';

// Marker strings that only shape's other output, an earlier challenge or the card's answer carry.
const SHAPE_NOTE = 'SHAPE-PRIVATE-REASONING-7c1';
const OLD_EVIDENCE = 'OLD-CHALLENGE-EVIDENCE-4b2';
const ANSWER_WORDS = 'CARD-ANSWER-WORDS-9d0';

async function revisedChallengeRun() {
  const w = world();
  await w.start();
  // shape returns its issue plus extra output the schema does not name (notes): the challenge must not see it
  const first = await w.agent('shape', { issue: ISSUE(1), notes: `${SHAPE_NOTE}: I assumed rounding half up` });
  assert.ok(first.got.accepted, JSON.stringify(first.got));
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.agent('shape', { issue: ISSUE(2), notes: SHAPE_NOTE });
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.agent('shape', { issue: ISSUE(3) });
  await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', OLD_EVIDENCE));
  await w.tap({ choice: 'revise', by: 'person', why: ANSWER_WORDS });
  await w.agent('shape', { issue: ISSUE(4), notes: SHAPE_NOTE });
  assert.equal(w.state(), 'challenging');
  return { w, run: w.openRun('challenge') };
}

test('the challenge prompt holds the request and the issue, and nothing else of shape\'s, of earlier rounds or of the card', async () => {
  const { w, run } = await revisedChallengeRun();
  const prepared = w.runs('challenge').at(-1);
  assert.equal(prepared.run, run.id);
  assert.deepEqual(Object.keys(prepared.input).sort(), ['issue', 'request', 'task']);
  assert.deepEqual(prepared.input.request, REQUEST);
  assert.deepEqual(prepared.input.issue, { ...ISSUE(4), url: REQUEST.url });
  const prompt = read(join(runDir(w.root, run.id), 'brief.md'));
  const context = read(join(runDir(w.root, run.id), 'context.md'));
  assert.ok(prompt.includes(REQUEST.text), 'request text in the prompt');
  assert.ok(prompt.includes(REQUEST.url), 'request url in the prompt');
  for (const v of [ISSUE(4).title, ISSUE(4).problem, ISSUE(4).outcome, ...ISSUE(4).expect, ISSUE(4).non_goals[0], ISSUE(4).assumptions[0]]) {
    assert.ok(prompt.includes(v), `issue field in the prompt: ${v}`);
  }
  for (const secret of [SHAPE_NOTE, OLD_EVIDENCE, ANSWER_WORDS, ISSUE(3).title]) {
    assert.ok(!prompt.includes(secret), `prompt leaks ${secret}`);
    assert.ok(!context.includes(secret), `context leaks ${secret}`);
  }
  // the shape run of the same round did get the answer (the marker test is not vacuous)
  const shapePrompt = read(join(runDir(w.root, w.runs('shape').at(-1).run), 'brief.md'));
  assert.ok(shapePrompt.includes(ANSWER_WORDS) && shapePrompt.includes(OLD_EVIDENCE));
});

test('accept refuses challenge results that skip, add, reorder or contradict lines, or whose result disagrees', async () => {
  const { w, run } = await revisedChallengeRun();
  const issue = { ...ISSUE(4), url: REQUEST.url };
  const good = VERDICT(issue, 'FAIL', 'x');
  const bad = {
    skip: { ...good, lines: good.lines.slice(0, 1) },
    add: { ...good, lines: [...good.lines, { line: 'the avg command rounds too', result: 'PASS', evidence: 'e' }] },
    reorder: { ...good, lines: [...good.lines].reverse() },
    contradict: { ...good, lines: [{ ...good.lines[0], line: good.lines[0].line.replace('0.3', '0.30') }, good.lines[1]] },
    'PASS with a FAIL line': { ...good, result: 'PASS' },
    'FAIL with every line PASS': { ...VERDICT(issue, 'PASS'), result: 'FAIL' },
    'no lines': { ...good, lines: [] },
    'no wrong_build': { result: good.result, lines: good.lines }
  };
  const seen = {};
  for (const [name, result] of Object.entries(bad)) {
    const { got } = await w.agent('challenge', result, { drive: false }).catch((e) => ({ got: { threw: String(e) } }));
    seen[name] = got.refused?.rule ?? JSON.stringify(got);
    assert.ok(got.refused, `${name}: not refused: ${JSON.stringify(got)}`);
  }
  assert.equal(w.state(), 'challenging', 'nothing reached the item');
  // a good result is then accepted, and the item moves (third FAIL after revise: the card)
  const ok = await w.agent('challenge', good);
  assert.ok(ok.got.accepted, JSON.stringify(ok.got));
  assert.equal(w.state(), 'stuck');
  // the refusals are journaled
  const refusals = w.rows().filter((r) => r.kind === 'refusal' && r.payload.run === run.id);
  assert.equal(refusals.length, Object.keys(bad).length);
  console.log(JSON.stringify(seen));
});
