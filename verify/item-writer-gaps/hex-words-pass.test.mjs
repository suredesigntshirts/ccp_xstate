// Expect hex-words-pass: on a temp copy of the head's plan/, a ready item whose Expect check holds words of seven or
// more letters all between a and f passes node plan/check.mjs, and the same item holding a 7-digit or a 40-digit sha
// with a digit in it is refused naming the sha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCopy, readyItem } from './lib.mjs';

const ID = 'iwg-hex';
const withCheck = (check) => {
  const { head, rest } = readyItem(ID);
  head.expect = head.expect.map((e, i) => (i === 0 ? { ...e, check } : e));
  return { head, rest };
};
const last = (out) => out.trim().split('\n').at(-1);

test('words made only of the letters a to f pass the plan check', (t) => {
  const p = planCopy(t);
  for (const check of [
    'A defaced page and an effaced label are both shown in the report',
    'The accede and deedbad words stay, and a bead or a facade too: decaded, baddeed, cabbaged',
    'The DEFACED header and a Deadbeef marker are kept',
  ]) {
    p.add(...Object.values(withCheck(check)));
    const r = p.check();
    t.diagnostic(`${JSON.stringify(check)}: exit ${r.status}, ${last(r.out)}`);
    assert.equal(r.status, 0, r.out);
  }
});

test('a sha holding a digit is still refused, naming the sha', (t) => {
  const p = planCopy(t);
  for (const sha of ['a575897', 'deadbe1', '1234567', 'ae70217b923d39bba381423bcafba64ae3cda3ea', 'fce872b', 'ABCDEF0']) {
    p.add(...Object.values(withCheck(`The suite passes at ${sha} and at the head`)));
    const r = p.check();
    t.diagnostic(`${sha}: exit ${r.status}, ${r.out.trim().split('\n').find((l) => l.includes(ID)) ?? last(r.out)}`);
    assert.equal(r.status, 1, r.out);
    assert.ok(r.out.includes(`${ID}.md`) && r.out.includes(sha), r.out);
  }
});

test('a word of hex letters beside a sha does not hide the sha', (t) => {
  const p = planCopy(t);
  p.add(...Object.values(withCheck('A defaced page at 6ff276e is shown')));
  const r = p.check();
  t.diagnostic(last(r.out));
  assert.equal(r.status, 1, r.out);
  assert.ok(r.out.includes('6ff276e'), r.out);
});

test('six hex characters, or seven hex characters inside a longer word, are not a sha', (t) => {
  const p = planCopy(t);
  for (const check of ['A count of 123456 is shown', 'The id x1234567y and the path a1b2c3d4_x are shown']) {
    p.add(...Object.values(withCheck(check)));
    const r = p.check();
    t.diagnostic(`${JSON.stringify(check)}: exit ${r.status}`);
    assert.equal(r.status, 0, r.out);
  }
});
