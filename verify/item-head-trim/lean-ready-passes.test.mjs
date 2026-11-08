// Expect lean-ready-passes: on a temp copy of the head's plan/, check.mjs passes a ready build item with no verifier
// and no step_back that meets every other ready rule, and refuses it (exit 1, naming the field) with expect, outputs
// or why emptied.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planCopy } from './lib.mjs';

test('a ready build head with no verifier and no step_back passes the plan check', (t) => {
  const plan = planCopy(t);
  const r = plan.withItem('iht-lean');
  t.diagnostic(`fields: ${Object.keys(r.head).join(', ')}`);
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').slice(-2).join(' | ')}`);
  assert.equal(r.head.kind, 'build');
  assert.equal(r.head.status, 'ready');
  assert.ok(!('verifier' in r.head) && !('step_back' in r.head));
  assert.equal(r.status, 0, r.out);
});

for (const [field, empty] of [['expect', []], ['outputs', []], ['why', '']]) {
  test(`the same lean head with ${field} emptied is refused, naming ${field}`, (t) => {
    const plan = planCopy(t);
    const r = plan.withItem(`iht-no-${field}`, (h) => ({ ...h, [field]: empty }));
    t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').filter((l) => l.includes(`iht-no-${field}`)).join(' | ')}`);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, new RegExp(`iht-no-${field}\\.md: ready, but ${field} is empty`));
  });
}
