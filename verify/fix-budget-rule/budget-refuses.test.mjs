// budget-refuses: three done fix items to module M with done_on in the last 14 days refuse a fourth fix at ready,
// by name; two pass; one aged out (15 days) passes; a later done design item resets; an earlier one does not;
// a ready non-fix item naming M (the design item) passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempPlan, daysAgo } from './lib.mjs';

const M = 'packages/vfy/m.js';
const FIXES = ['fix-vfy-a', 'fix-vfy-b', 'fix-vfy-c'];

function setup(t, ages = [1, 3, 5]) {
  const p = tempPlan(t);
  p.touch(M);
  FIXES.slice(0, ages.length).forEach((id, i) => p.add(id, { status: 'done', module: M, done_on: daysAgo(ages[i]) }));
  return p;
}
const fourth = (p, status = 'ready') => p.add('fix-vfy-fourth', { status, module: M, done_on: undefined });
const refusal = (r) => r.out.split('\n').find((l) => l.includes('fix-vfy-fourth'));

test('three done fixes in 14 days refuse a ready fourth, naming M, the three ids and plan/README.md', (t) => {
  const p = setup(t);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  const line = refusal(r);
  assert.ok(line.includes(M), line);
  for (const id of FIXES) assert.ok(line.includes(id), `${id} in ${line}`);
  assert.ok(line.includes('plan/README.md'), line);
  console.log(line);
});

test('with two such fixes it passes', (t) => {
  const p = setup(t, [1, 3]);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a fix done exactly 14 days ago still counts', (t) => {
  const p = setup(t, [1, 3, 14]);
  fourth(p);
  assert.equal(p.run().code, 1);
});

test('with one of the three done 15 days ago it passes', (t) => {
  const p = setup(t, [1, 3, 15]);
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done non-fix item naming M after the three makes it pass', (t) => {
  const p = setup(t, [3, 4, 5]);
  p.add('vfy-design-after', { status: 'done', module: M, done_on: daysAgo(1) });
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done non-fix item naming M dated before the three does not', (t) => {
  const p = setup(t, [1, 2, 3]);
  p.add('vfy-design-before', { status: 'done', module: M, done_on: daysAgo(6) });
  fourth(p);
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  assert.ok(refusal(r).includes(M));
});

test('a ready non-fix item naming M (the design item) passes', (t) => {
  const p = setup(t);
  p.add('vfy-design-ready', { status: 'ready', module: M, done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a draft fourth fix is not counted or refused', (t) => {
  const p = setup(t);
  fourth(p, 'draft');
  assert.equal(p.run().code, 0);
});
