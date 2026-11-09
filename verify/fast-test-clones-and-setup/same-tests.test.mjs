// same-tests: the test files this PR changes run the same test names as at the PR's base, none skipped that ran
// there, and all pass. Here the files are read at both commits: the diff touches no test's name, adds no skip or todo,
// and leaves each file with the same test calls. record.mjs runs them at base and head with the TAP reporter and
// compares names and results (evidence/same-tests.md); npm test runs them at the head on every PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, VERIFIED, git, gitDir, isTest, show } from './lib.mjs';

/** The first-argument text of every test( ... ) call, and the skip/todo markers, in a test file's source. */
function shape(src) {
  const names = [...src.matchAll(/\btest\(\s*(`[^`]*`|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")/g)].map((m) => m[1]);
  const skips = [...src.matchAll(/\b(?:test|it|describe)\.(?:skip|todo)\b|\{\s*(?:skip|todo)\s*:|\bt\.(?:skip|todo)\(/g)].length;
  return { names, skips };
}

test('same-tests: each test file the PR changes keeps its test names and adds no skip', (t) => {
  assert.ok(gitDir(), 'the base and verified commits are readable');
  const changed = git(['diff', '--name-only', BASE, VERIFIED]).split('\n').filter((p) => isTest(p));
  t.diagnostic(`changed test files: ${changed.join(', ')}`);
  assert.ok(changed.length >= 5, 'the PR changes test files');
  for (const p of changed) {
    const before = shape(show(BASE, p)), after = shape(show(VERIFIED, p));
    assert.deepEqual(after.names, before.names, `${p}: the same test calls, same names, same order`);
    assert.ok(after.skips <= before.skips, `${p}: no skip or todo added`);
    t.diagnostic(`${p}: ${after.names.length} test calls, ${after.skips} skip markers`);
  }
});

test('same-tests: no changed line in those files is a test name line', () => {
  const diff = git(['diff', '-U0', BASE, VERIFIED, '--', '*.test.mjs', '*.test.js']);
  const touched = diff.split('\n').filter((l) => /^[+-][^+-]/.test(l) && /\btest\(\s*[`'"]/.test(l));
  assert.deepEqual(touched, []);
});
