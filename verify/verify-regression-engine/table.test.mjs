// table-complete: the item's Regression table has one row per *.test.mjs file the 26 suites held at the base, no
// other row, a verdict of moved, split or left with a reason, and every destination it names exists under one of
// the eight areas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS, BASE, REPO, SUITES, haveCommits, lsTree, regressionTable } from './lib.mjs';

test('table-complete: the rows are exactly the base suites\' test files, each with a verdict and a reason', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  const atBase = SUITES.flatMap((s) => lsTree(BASE, `verify/${s}`).filter((p) => p.endsWith('.test.mjs')).map((p) => p.slice(`verify/${s}/`.length).replace(/^/, `${s}/`)));
  const rows = regressionTable();
  const named = rows.map((r) => `${r.suite}/${r.file}`);
  assert.equal(new Set(named).size, named.length, 'no file has two rows');
  assert.deepEqual([...named].sort(), [...atBase].sort());
  assert.ok(atBase.length > 50, `the base held ${atBase.length} test files`);
  for (const r of rows) {
    assert.ok(['moved', 'split', 'left'].includes(r.verdict), `${r.suite}/${r.file}: verdict ${r.verdict}`);
    assert.ok(r.reason.length > 0, `${r.suite}/${r.file}: a reason`);
    if (r.verdict === 'left') assert.equal(r.to, '', `${r.suite}/${r.file}: left names no destination`);
    else assert.ok(r.to, `${r.suite}/${r.file}: ${r.verdict} names a destination`);
    if (r.verdict === 'split') assert.match(r.reason, /moved:.*\bleft\b/, `${r.suite}/${r.file}: a split names both halves`);
  }
  t.diagnostic(`${rows.length} rows: ${['moved', 'split', 'left'].map((v) => `${rows.filter((r) => r.verdict === v).length} ${v}`).join(', ')}`);
});

test('table-complete: every destination exists under test/regression/<area>/ for one of the eight areas', () => {
  const rows = regressionTable().filter((r) => r.to);
  assert.ok(rows.length > 0);
  for (const r of rows) {
    const m = r.to.match(/^test\/regression\/([^/]+)\/[^/]+\.test\.mjs$/);
    assert.ok(m, `${r.suite}/${r.file}: ${r.to} is test/regression/<area>/<name>.test.mjs`);
    assert.ok(AREAS.includes(m[1]), `${r.to}: area ${m[1]}`);
    assert.ok(existsSync(join(REPO, r.to)), `${r.to} exists`);
  }
});

test('table-complete: the parser sees a missing or an extra row (control)', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  const rows = regressionTable().map((r) => `${r.suite}/${r.file}`);
  const atBase = new Set(SUITES.flatMap((s) => lsTree(BASE, `verify/${s}`).filter((p) => p.endsWith('.test.mjs')).map((p) => `${s}/${p.slice(`verify/${s}/`.length)}`)));
  assert.notDeepEqual(rows.slice(1).sort(), [...atBase].sort());
  assert.notDeepEqual([...rows, 'engine-host/made-up.test.mjs'].sort(), [...atBase].sort());
});
