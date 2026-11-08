// Expect categories: a branch that adds and removes lines in a source file, a test file outside verify/, a test file
// under verify/<item>/, a non-test file under verify/<item>/, a markdown file and a workflow stage file is split the way
// plan/decisions/2026-11-08-plan-reader-effort.md section 2 says (the stage file and packages/engine/messages.md count
// as code); the PR-number argument finds the same range from the merge commit titled "Merge pull request #7 ...".
// The expected numbers below come from the decision's rules applied by hand, not from the script.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lines, tempRepo } from './lib.mjs';

// Content of a file that started as lines(n, tag) after dropping its last `drop` lines and appending `add` new ones:
// git counts `add` added and `drop` removed.
const edit = (n, tag, drop, add) => lines(n, tag).split('\n').slice(0, n - drop).join('\n') + (n - drop ? '\n' : '') +
  (add ? lines(add, `${tag}-new`) : '');

const BASE = {
  'src/app.mjs': lines(10, 'app'),
  'src/old.mjs': lines(4, 'old'),
  'src/app.test.mjs': lines(5, 'apptest'),
  'verify/toy/a.test.mjs': lines(5, 'va'),
  'verify/toy/evidence/e.md': lines(5, 'ev'),
  'docs/note.md': lines(5, 'note'),
  'workflows/quick-fix/plan.md': lines(5, 'stage'),
  'packages/engine/messages.md': lines(3, 'msg'),
};
const BRANCH = {
  // code: +3 -1, +2 -2 (stage file), +1 (messages.md), +4 (new json), -4 (deleted) => +10 -7
  'src/app.mjs': edit(10, 'app', 1, 3),
  'workflows/quick-fix/plan.md': edit(5, 'stage', 2, 2),
  'packages/engine/messages.md': edit(3, 'msg', 0, 1),
  'src/config.json': lines(4, 'cfg'),
  'src/old.mjs': null,
  // tests: +2 -1 (*.test.mjs), +3 (under test/), +1 (under fixtures/) => +6 -1
  'src/app.test.mjs': edit(5, 'apptest', 1, 2),
  'test/helpers/x.mjs': lines(3, 'th'),
  'packages/engine/fixtures/sample.txt': lines(1, 'fx'),
  // verifier: +4 (verify/<item>/*.test.mjs), +2 (verify/<item>/lib.mjs, still a .mjs) => +6 -0
  'verify/toy/a.test.mjs': edit(5, 'va', 0, 4),
  'verify/toy/lib.mjs': lines(2, 'vl'),
  // evidence: +5 -2 (evidence .md), +3 (verdict.json), +1 (a .md under verify/ is evidence, not docs) => +9 -2
  'verify/toy/evidence/e.md': edit(5, 'ev', 2, 5),
  'verify/toy/verdict.json': lines(3, 'vd'),
  'verify/toy/notes.md': lines(1, 'vn'),
  // docs: +1 -3, +2 => +3 -3
  'docs/note.md': edit(5, 'note', 3, 1),
  'README.md': lines(2, 'rd'),
};
const WANT = {
  files: Object.keys(BRANCH).length,
  added: { code: 10, tests: 6, verifier: 6, evidence: 9, docs: 3 },
  removed: { code: 7, tests: 1, verifier: 0, evidence: 2, docs: 3 },
};

function build(t) {
  const r = tempRepo(t);
  const base = r.commit(BASE, 'base files');
  r.branch('feature');
  const head = r.commit(BRANCH, 'the change');
  const merge = r.merge('feature', 7);
  return { r, base, head, merge };
}

test('the git numstat of the temp branch is what the fixture means it to be', (t) => {
  const { r, base, head } = build(t);
  const rows = r.git('diff', '--no-renames', '--numstat', base, head).split('\n');
  const total = rows.reduce((a, row) => { const [x, y] = row.split('\t'); return [a[0] + +x, a[1] + +y]; }, [0, 0]);
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  assert.equal(rows.length, WANT.files);
  assert.deepEqual(total, [sum(WANT.added), sum(WANT.removed)]);
});

test('a base..head range splits each file into the category the decision gives it', (t) => {
  const { r, base, head } = build(t);
  const got = r.effort(`${base}..${head}`);
  t.diagnostic(JSON.stringify(got));
  assert.equal(got.pr, undefined);
  assert.equal(got.files, WANT.files);
  assert.deepEqual(got.added, WANT.added);
  assert.deepEqual(got.removed, WANT.removed);
});

test('the PR number finds the merge titled "Merge pull request #7" and reports the same numbers', (t) => {
  const { r, base, merge } = build(t);
  // A later unrelated merge whose number starts with 7 must not be taken for #7.
  r.branch('other');
  r.commit({ 'src/later.mjs': lines(50, 'later') }, 'later');
  r.merge('other', 70);
  const got = r.effort('7');
  const range = r.effort(`${base}..${merge}`);
  t.diagnostic(JSON.stringify(got));
  assert.equal(got.pr, 7);
  assert.equal(got.files, WANT.files);
  assert.deepEqual(got.added, WANT.added);
  assert.deepEqual(got.removed, WANT.removed);
  assert.deepEqual({ ...got, pr: undefined }, { ...range, pr: undefined });
});
