// Expect done-heads-pass: check.mjs passes on the head's real plan, where done items still carry verifier,
// step_back.max_tokens and step_back.replan_to; on a temp copy, a ready item whose step_back has max_rounds 3 passes and
// one whose max_rounds is 0 is refused.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { REPO, heads, node, planCopy } from './lib.mjs';

test('the real plan passes, and done items there still carry verifier, max_tokens and replan_to', (t) => {
  const done = heads().filter((h) => h.head.status === 'done');
  const count = (f) => done.filter((h) => f(h.head)).length;
  const n = { verifier: count((h) => 'verifier' in h), max_tokens: count((h) => 'max_tokens' in (h.step_back ?? {})),
    replan_to: count((h) => 'replan_to' in (h.step_back ?? {})) };
  t.diagnostic(`done items: ${done.length}; carrying verifier ${n.verifier}, max_tokens ${n.max_tokens}, replan_to ${n.replan_to}`);
  for (const k of Object.keys(n)) assert.ok(n[k] > 0, `some done item carries ${k}`);
  const r = node([join(REPO, 'plan/check.mjs')], { cwd: REPO });
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').slice(-2).join(' | ')}`);
  assert.equal(r.status, 0, r.out);
});

test('a ready step_back of max_rounds 3 passes; max_rounds 0 is refused', (t) => {
  const plan = planCopy(t);
  const three = plan.withItem('iht-three', (h) => ({ ...h, step_back: { max_rounds: 3 } }));
  t.diagnostic(`max_rounds 3: exit ${three.status}`);
  assert.equal(three.status, 0, three.out);
  const zero = plan.withItem('iht-zero', (h) => ({ ...h, step_back: { max_rounds: 0 } }));
  const said = zero.out.trim().split('\n').filter((l) => l.includes('iht-zero'));
  t.diagnostic(`max_rounds 0: exit ${zero.status}: ${said.join(' | ')}`);
  assert.equal(zero.status, 1, zero.out);
  assert.match(zero.out, /iht-zero\.md\.step_back\.max_rounds/);
});
