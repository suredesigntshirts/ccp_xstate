// Expect reader-lines: a changed hunk that calls a function defined in a file the branch does not change raises
// reader_lines by that definition's line count once, however many times it is called; a call to a name the repo does
// not define adds nothing; a definition the branch itself adds is not counted twice; evidence lines are not in
// reader_lines. Expected numbers follow plan/decisions/2026-11-08-plan-reader-effort.md section 3 by hand: every
// added or removed non-evidence line, plus once each the span of a called top-level definition.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lines, tempRepo } from './lib.mjs';

const UTIL = [
  'export function helper(x) {', //  4 lines
  '  const y = x + 1;',
  '  return y * 2;',
  '}',
  'export const one = (x) => x;', // 1 line: closes on its own line
  'export const arrow = (x) => {', // 3 lines
  '  return x;',
  '};',
  '',
].join('\n');
const MAIN = "import { helper, one, arrow } from './util.mjs';\n" + lines(4, '// main');

function repo(t) {
  const r = tempRepo(t);
  const base = r.commit({ 'src/util.mjs': UTIL, 'src/main.mjs': MAIN, 'src/main.test.mjs': "import test from 'node:test';\n" }, 'base');
  r.branch('change');
  return { r, base };
}
const effort = (t, r, base, files) => {
  const head = r.commit(files, 'change');
  const got = r.effort(`${base}..${head}`);
  t.diagnostic(`reader_lines ${got.reader_lines}; added ${JSON.stringify(got.added)} removed ${JSON.stringify(got.removed)}`);
  return got;
};

test('three calls to an unchanged file\'s 4-line definition, from code and a test, add its 4 lines once', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/main.mjs': MAIN + 'helper(1);\nhelper(2);\nconst z = helper(3);\n',
    'src/main.test.mjs': "import test from 'node:test';\nhelper(4);\n",
  });
  assert.equal(got.reader_lines, 3 + 1 + 4);
});

test('a one-line and a three-line definition add one and three lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, { 'src/main.mjs': MAIN + 'one(1);\narrow(2);\n' });
  assert.equal(got.reader_lines, 2 + 1 + 3);
});

test('a call to a name the repo does not define adds nothing', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, { 'src/main.mjs': MAIN + 'nosuch(1);\nalsoMissing();\n' });
  assert.equal(got.reader_lines, 2);
});

test('a definition the branch adds, in a new file or in the changed file, is counted once as hunk lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/fresh.mjs': 'export function fresh() {\n  return 1;\n}\n', // 3 added lines
    'src/main.mjs': MAIN + "function local() {\n  return 2;\n}\nfresh();\nlocal();\n", // 5 added lines
  });
  assert.equal(got.reader_lines, 3 + 5);
});

test('evidence lines are reported but not in reader_lines', (t) => {
  const { r, base } = repo(t);
  const got = effort(t, r, base, {
    'src/main.mjs': MAIN + 'helper(1);\n',
    'verify/toy/evidence/calls.md': lines(10, 'helper(9) '),
    'verify/toy/verdict.json': '{ "x": "helper(8)" }\n',
  });
  assert.equal(got.added.evidence, 11);
  assert.equal(got.reader_lines, 1 + 4);
});
