// scope: the PR, from main at its base to its head, changes only finish-ms.test.mjs and the item file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, HEAD, git, pinned } from './lib.mjs';

test('git diff --name-only base head names only the test file and the item file', () => {
  const files = git(pinned(), 'diff', '--name-only', BASE, HEAD).split('\n').filter(Boolean).sort();
  assert.deepEqual(files, ['plan/items/finish-ms-transcript-fixture.md', 'plugins/harness/test/finish-ms.test.mjs']);
});
