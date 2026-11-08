// scope: the files the build changes between the PR's base and the verified head, leaving out this verifier's own
// folder, against the item's scope line: the script, its test file and the item file only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, HEAD, ensure, git } from './lib.mjs';

const ALLOWED = ['scripts/debug/trace-writes.mjs', 'scripts/debug/trace-writes.test.mjs', 'plan/items/fix-trace-writes-clone-cwd.md'];

test('the PR changes only the script, its test file and the item file', (t) => {
  assert.ok(ensure(BASE) && ensure(HEAD), 'base and head commits readable');
  const files = git('diff', '--name-only', BASE, HEAD).split('\n').filter(Boolean)
    .filter((f) => !f.startsWith('verify/fix-trace-writes-clone-cwd/'));
  t.diagnostic(files.join(', '));
  assert.ok(files.includes('scripts/debug/trace-writes.mjs'));
  assert.deepEqual(files.filter((f) => !ALLOWED.includes(f)), []);
});
