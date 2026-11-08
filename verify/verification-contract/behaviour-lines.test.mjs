// Expect behaviour-lines: on a temp copy of the head's plan/, check.mjs refuses a ready item whose Expect
// check holds a phrase decision 1 lists or a sha, naming the item, the Expect id and the phrase; draft and done pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DECISION_PHRASES, itemText, tempPlan } from './lib.mjs';

const ID = 'vfy-pins';
const withCheck = (status, check) => itemText(ID, {
  status,
  ...(status === 'done' ? { done_on: '2026-11-01' } : {}),
  expect: [
    { id: 'clean-line', check: 'The plan check refuses the copy; plan/README.md says why', how: 'run it', proof: 'verifier' },
    { id: 'pinned-line', check, how: 'run it', proof: 'verifier' },
    { id: 'world-line', check: 'A PR on GitHub shows the refusal', how: 'GitHub', proof: 'world' },
  ],
});

test('the untouched copy of the head plan passes', (t) => {
  const r = tempPlan(t).check();
  assert.equal(r.status, 0, r.out);
});

for (const phrase of DECISION_PHRASES) {
  for (const status of ['ready']) {
    test(`a ${status} item whose check says "${phrase}" is refused, naming item, Expect id and phrase`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `Every stage renders ${phrase} the record`));
      const r = p.check();
      assert.equal(r.status, 1, r.out);
      const line = r.out.split('\n').find((l) => l.includes(`${ID}.md`) && l.includes('pinned-line'));
      assert.ok(line, r.out);
      assert.ok(line.toLowerCase().includes(phrase), line);
      assert.ok(!r.out.includes('clean-line'), r.out);
    });
  }
  for (const status of ['draft', 'done']) {
    test(`a ${status} item whose check says "${phrase}" passes`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `Every stage renders ${phrase} the record`));
      const r = p.check();
      assert.equal(r.status, 0, r.out);
    });
  }
}

test('the phrase match ignores case', (t) => {
  const p = tempPlan(t);
  p.write(ID, withCheck('ready', 'The page renders to MAIN\'S output'));
  const r = p.check();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /pinned-line/);
});

for (const [label, sha] of [['7-digit', 'a575897'], ['40-digit', '25dddc9d60b3658e97d46ca9b8981630b73712bd']]) {
  for (const status of ['ready']) {
    test(`a ${status} item whose check holds a ${label} sha is refused, naming the item and Expect id`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `The suite passes at ${sha} and at the head`));
      const r = p.check();
      assert.equal(r.status, 1, r.out);
      const line = r.out.split('\n').find((l) => l.includes(`${ID}.md`) && l.includes('pinned-line'));
      assert.ok(line && line.includes(sha), r.out);
    });
  }
  for (const status of ['draft', 'done']) {
    test(`a ${status} item whose check holds a ${label} sha passes`, (t) => {
      const p = tempPlan(t);
      p.write(ID, withCheck(status, `The suite passes at ${sha} and at the head`));
      assert.equal(p.check().status, 0);
    });
  }
}

test('a ready check that names repo paths and no listed phrase passes', (t) => {
  const p = tempPlan(t);
  p.write(ID, withCheck('ready', 'plan/README.md and docs/gates.md state the rule; scripts/gates/lib.mjs refuses a verdict with no test, at the head'));
  const r = p.check();
  assert.equal(r.status, 0, r.out);
});
