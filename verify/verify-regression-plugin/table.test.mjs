// table-complete: the item's Regression table has one row per *.test.mjs file the 19 suites held at the base, no
// other row, a verdict of moved, split or left with a reason, and every destination it names exists under one of
// the eight areas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS, BASE, REPO, baseTests, haveCommits, regressionTable } from './lib.mjs';

test('table-complete: the rows are exactly the base suites\' test files, each with a verdict and a reason', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  const atBase = baseTests();
  const rows = regressionTable();
  const named = rows.map((r) => r.file);
  assert.equal(new Set(named).size, named.length, 'no file has two rows');
  assert.deepEqual([...named].sort(), [...atBase].sort());
  assert.ok(atBase.length >= 40, `the base held ${atBase.length} test files`);
  for (const r of rows) {
    assert.ok(['moved', 'split', 'left'].includes(r.verdict), `${r.file}: verdict ${r.verdict}`);
    assert.ok(r.reason.length > 0, `${r.file}: a reason`);
    if (r.verdict === 'left') assert.equal(r.to, '', `${r.file}: left names no destination`);
    else assert.ok(r.to, `${r.file}: ${r.verdict} names a destination`);
    if (r.verdict === 'split') assert.match(r.reason, /moved:.*\bleft:/, `${r.file}: a split names both halves`);
  }
  t.diagnostic(`${rows.length} rows: ${['moved', 'split', 'left'].map((v) => `${rows.filter((r) => r.verdict === v).length} ${v}`).join(', ')}`);
});

test('table-complete: every destination exists under test/regression/<area>/ for one of the eight areas', () => {
  const rows = regressionTable().filter((r) => r.to);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    const m = r.to.match(/^test\/regression\/([^/]+)\/[^/]+\.test\.mjs$/);
    assert.ok(m, `${r.file}: ${r.to} is test/regression/<area>/<name>.test.mjs`);
    assert.ok(AREAS.includes(m[1]), `${r.to}: area ${m[1]}`);
    assert.ok(existsSync(join(REPO, r.to)), `${r.to} exists`);
  }
});

test('table-complete: the comparison sees a missing or an extra row (control)', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  const rows = regressionTable().map((r) => r.file);
  const atBase = baseTests();
  assert.notDeepEqual(rows.slice(1).sort(), [...atBase].sort());
  assert.notDeepEqual([...rows, 'verify/obs-page/made-up.test.mjs'].sort(), [...atBase].sort());
});
