// table-row: verify-regression-set's Regression table row for child-after-return.test.mjs reads moved at the head,
// read as split at the base, and no other row of the table changed between base and verified head.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, VERIFIED, gitDir, show } from './lib.mjs';

const FILE = 'verify/fix-trace-writes-clone-cwd/child-after-return.test.mjs';
const rows = (text) => {
  const lines = text.split('\n');
  let i = lines.findIndex((l) => l.trim() === '## Regression table');
  assert.ok(i >= 0, 'a Regression table');
  while (!lines[i].startsWith('|')) i++;
  const out = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) out.push(lines[i]);
  return out.slice(2);
};
const cells = (row) => row.slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, ''));

test('table-row: child-after-return reads moved at the head, split at the base, and no other row changed', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE.slice(0, 7)} not readable here`);
  const before = rows(show(BASE, 'plan/items/verify-regression-set.md'));
  const after = rows(show(VERIFIED, 'plan/items/verify-regression-set.md'));
  assert.equal(after.length, before.length, 'same number of rows');
  assert.ok(before.length > 100, `${before.length} rows`);
  const changed = before.map((b, i) => [b, after[i]]).filter(([b, a]) => b !== a);
  assert.equal(changed.length, 1, changed.map(([b, a]) => `${b}\n${a}`).join('\n\n'));
  const [b, a] = changed[0].map(cells);
  assert.equal(a[0], FILE);
  assert.equal(b[1], 'split');
  assert.equal(a[1], 'moved');
  assert.deepEqual([a[0], a[2], a[3]], [b[0], b[2], b[3]], 'only the verdict cell changed');
});
