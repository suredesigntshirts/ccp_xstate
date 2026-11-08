// Expect doing-refused: on a temp copy of the head's plan/, an item whose status is doing makes plan/check.mjs exit
// non-zero naming that item's status field; the same item at ready or done does not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemText, tempPlan } from './lib.mjs';

const ID = 'rd-probe';

test('the untouched copy of the head plan passes', (t) => {
  const r = tempPlan(t).check();
  assert.equal(r.status, 0, r.out);
});

test('an item at doing is refused, naming its status field', (t) => {
  const p = tempPlan(t);
  p.write(ID, itemText(ID, { status: 'doing' }));
  const r = p.check();
  t.diagnostic(r.out.trim());
  assert.notEqual(r.status, 0, r.out);
  const lines = r.out.split('\n').filter((l) => l.includes(`${ID}.md`));
  assert.ok(lines.some((l) => /\.status\b/.test(l)), r.out);
});

for (const status of ['ready', 'done']) {
  test(`the same item at ${status} passes`, (t) => {
    const p = tempPlan(t);
    p.write(ID, itemText(ID, { status }));
    const r = p.check();
    t.diagnostic(r.out.trim().split('\n').at(-1));
    assert.equal(r.status, 0, r.out);
  });
}
