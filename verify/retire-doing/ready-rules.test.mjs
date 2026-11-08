// Expect ready-rules: on a temp copy of the head's plan/, the plan check refuses a ready item whose Expect check pins
// main, a ready item naming a module that does not exist, and a ready fourth fix to a module with three done fixes in
// 14 days; in a temp repo the freeze gate refuses a PR without the replan label that changes the Expect lines of an
// item done at the base, and passes one that changes a ready item the PR does not name and that has no verdict file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRepo, headOf, itemText, tempPlan } from './lib.mjs';

const MOD = 'lib/rd-module.js';
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const withCheck = (id, status, check) => {
  const head = headOf(itemText(id));
  return itemText(id, { status, expect: head.expect.map((e, i) => (i === 0 ? { ...e, check } : e)) });
};

test('a ready item whose Expect check pins main is refused; the same check on a draft passes', (t) => {
  const p = tempPlan(t);
  p.write('rd-pin', withCheck('rd-pin', 'ready', 'The record renders as on main'));
  const r = p.check();
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('rd-pin')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /rd-pin\.md/);
  assert.match(r.out, /as on main/);
  const q = tempPlan(t);
  q.write('rd-pin', withCheck('rd-pin', 'draft', 'The record renders as on main'));
  assert.equal(q.check().status, 0);
});

test('a ready item naming a module that does not exist is refused; with the module made it passes', (t) => {
  const p = tempPlan(t);
  p.write('rd-mod', itemText('rd-mod', { module: MOD }));
  const r = p.check();
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('rd-mod')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /rd-mod\.md.*module lib\/rd-module\.js does not exist/);
  const q = tempPlan(t, { modules: [MOD] });
  q.write('rd-mod', itemText('rd-mod', { module: MOD }));
  assert.equal(q.check().status, 0, q.check().out);
});

test('a ready fourth fix to a module with three done fixes in 14 days is refused; with two it passes', (t) => {
  const run = (n) => {
    const p = tempPlan(t, { modules: [MOD] });
    for (let i = 0; i < n; i++)
      p.write(`fix-rd-done${i}`, itemText(`fix-rd-done${i}`, { status: 'done', module: MOD, done_on: daysAgo(i + 1) }));
    p.write('fix-rd-next', itemText('fix-rd-next', { module: MOD }));
    return p.check();
  };
  const r = run(3);
  t.diagnostic(r.out.trim().split('\n').filter((l) => l.includes('fix-rd-next')).join(' | '));
  assert.notEqual(r.status, 0, r.out);
  assert.match(r.out, /fix-rd-next\.md: .*fourth fix to lib\/rd-module\.js/);
  const two = run(2);
  assert.equal(two.status, 0, two.out);
});

const changeExpect = (text) => {
  const head = headOf(text);
  return itemText(head.id, { ...head, expect: [...head.expect, { id: 'added', check: 'One more line holds', how: 'a test',
    proof: 'verifier' }] });
};

test('freeze refuses a PR without the replan label that changes the Expect lines of an item done at the base', (t) => {
  const done = itemText('rd-done', { status: 'done' });
  const r = gateRepo(t, { 'plan/items/rd-done.md': done });
  r.branch('build/other');
  r.commit({ 'plan/items/rd-done.md': changeExpect(done) }, 'change a done item');
  const out = r.gate('freeze', { branch: 'build/other', body: 'Changes things.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /rd-done/);
});

test('freeze passes a PR that changes a ready item it does not name and that has no verdict file', (t) => {
  const ready = itemText('rd-ready');
  const r = gateRepo(t, { 'plan/items/rd-ready.md': ready });
  r.branch('build/other');
  r.commit({ 'plan/items/rd-ready.md': changeExpect(ready) }, 'change a ready item');
  const out = r.gate('freeze', { branch: 'build/other', body: 'Changes things.' });
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
});
