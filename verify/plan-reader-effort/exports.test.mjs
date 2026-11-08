// Expect exports: a branch that adds an export function, an export const, an export { a as b } and an export default
// to code files and removes one existing export reports exports_added 4 and exports_removed 1; exports in test and
// verifier files are not counted (plan/decisions/2026-11-08-plan-reader-effort.md section 4).
import test from 'node:test';
import assert from 'node:assert/strict';
import { tempRepo } from './lib.mjs';

const BASE = {
  'src/lib.mjs': 'export function old() {\n  return 0;\n}\n\nexport const keep = 1;\n',
  'src/util.js': 'const a = 1;\nexport function stays() {}\n',
  'src/lib.test.mjs': "import test from 'node:test';\n",
  'verify/toy/helpers.mjs': 'export const v = 1;\n',
};
const BRANCH = {
  // removes `old`, adds `added` and `C1`
  'src/lib.mjs': 'export function added() {\n  return 1;\n}\n\nexport const keep = 1;\nexport const C1 = 2;\n',
  // adds `b` (as a renamed export) and a default export
  'src/util.js': 'const a = 1;\nexport function stays() {}\nexport { a as b };\nexport default stays;\n',
  // exports in a test file and in verifier files: not counted
  'src/lib.test.mjs': "import test from 'node:test';\nexport function testHelper() {}\nexport const T = 1;\n",
  'verify/toy/helpers.mjs': 'export const v = 1;\nexport function verifierHelper() {}\nexport default 3;\n',
  'verify/toy/x.test.mjs': 'export const w = 1;\n',
};

test('four exports added and one removed across code files; test and verifier exports are not counted', (t) => {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base');
  r.branch('exports');
  const head = r.commit(BRANCH, 'exports');
  r.merge('exports', 12);
  const ranged = r.effort(`${base}..${head}`);
  const byPr = r.effort('12');
  t.diagnostic(`range: +${ranged.exports_added} -${ranged.exports_removed}; #12: +${byPr.exports_added} -${byPr.exports_removed}`);
  for (const got of [ranged, byPr]) {
    assert.equal(got.exports_added, 4);
    assert.equal(got.exports_removed, 1);
  }
});

test('with only test and verifier files changed, no export is counted', (t) => {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base');
  r.branch('tests-only');
  const head = r.commit({ 'src/lib.test.mjs': BRANCH['src/lib.test.mjs'], 'verify/toy/helpers.mjs': BRANCH['verify/toy/helpers.mjs'],
    'verify/toy/x.test.mjs': BRANCH['verify/toy/x.test.mjs'] }, 'tests only');
  const got = r.effort(`${base}..${head}`);
  assert.equal(got.exports_added, 0);
  assert.equal(got.exports_removed, 0);
});
