// Expect budget: test/docs.test.mjs holds the three entry texts to 225 lines and passes at the checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { REPO, node, read } from './lib.mjs';
import { join } from 'node:path';

const docsTest = read('test/docs.test.mjs');

test('BUDGET is 225 over the three entry texts', (t) => {
  assert.match(docsTest, /^const BUDGET = 225;$/m);
  assert.match(docsTest, /^const ENTRY = \['CLAUDE\.md', 'plan\/README\.md', 'docs\/gates\.md'\];$/m);
  const counts = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'].map((p) => [p, read(p).split('\n').length - 1]);
  const total = counts.reduce((a, [, n]) => a + n, 0);
  t.diagnostic(`${counts.map(([p, n]) => `${p} ${n}`).join(', ')}; total ${total}`);
  assert.ok(total < 225, `${total}`);
});

test('test/docs.test.mjs passes', (t) => {
  const r = node(['--test', '--test-reporter=tap', join(REPO, 'test/docs.test.mjs')]);
  t.diagnostic(r.out.split('\n').filter((l) => /^# (tests|pass|fail) /.test(l)).join(', '));
  assert.equal(r.status, 0, r.out.slice(-2000));
});
