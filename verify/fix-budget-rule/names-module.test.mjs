// names-module: a fix- item at ready, doing or done names module; at ready a module path that does not exist is
// refused; a done item naming a module needs done_on. Drafts and non-fix items without module pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tempPlan, daysAgo } from './lib.mjs';

test('the untouched copy of the head plan passes', (t) => {
  const p = tempPlan(t);
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

for (const status of ['ready', 'doing', 'done']) {
  test(`a ${status} fix item without module is refused by name and field`, (t) => {
    const p = tempPlan(t);
    p.add('fix-vfy-nomodule', { status, module: undefined, done_on: status === 'done' ? daysAgo(1) : undefined });
    const r = p.run();
    assert.equal(r.code, 1, r.out);
    const line = r.out.split('\n').find((l) => l.includes('fix-vfy-nomodule'));
    assert.ok(line, r.out);
    assert.match(line, /\(module\)|module/);
    console.log(status, '->', line);
  });
}

test('a ready fix item whose module path does not exist is refused', (t) => {
  const p = tempPlan(t);
  p.add('fix-vfy-ghost', { status: 'ready', module: 'packages/no/such.js', done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 1, r.out);
  const line = r.out.split('\n').find((l) => l.includes('fix-vfy-ghost'));
  assert.match(line, /packages\/no\/such\.js/);
  console.log(line);
});

test('the same item passes once the module path exists', (t) => {
  const p = tempPlan(t);
  p.touch('packages/no/such.js');
  p.add('fix-vfy-ghost', { status: 'ready', module: 'packages/no/such.js', done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});

test('a done item (fix or not) naming a module without done_on is refused', (t) => {
  for (const id of ['fix-vfy-nodate', 'vfy-design-nodate']) {
    const p = tempPlan(t);
    p.add(id, { status: 'done', module: 'packages/m.js', done_on: undefined });
    const r = p.run();
    assert.equal(r.code, 1, r.out);
    const line = r.out.split('\n').find((l) => l.includes(id));
    assert.match(line, /done_on/);
    console.log(line);
  }
});

test('a draft fix item without module, and a ready non-fix item without module, pass', (t) => {
  const p = tempPlan(t);
  p.add('fix-vfy-draft', { status: 'draft', module: undefined, done_on: undefined });
  p.add('vfy-plain-ready', { status: 'ready', module: undefined, done_on: undefined });
  const r = p.run();
  assert.equal(r.code, 0, r.out);
});
