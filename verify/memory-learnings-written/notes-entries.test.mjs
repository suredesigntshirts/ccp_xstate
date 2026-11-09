// traps-entries, verifying-entries, no-removed-traps: each harvested entry has its own section in its notes file, holding
// the terms that carry it, and neither notes file writes up a trap that code removed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read, sections, lacking } from './lib.mjs';

const TRAPS = {
  'What a thread may not do to GitHub': ['auto mode', 'git proxy', 'force push', 'amend or rebase of a pushed branch',
    'branch delete', 'tag push', 'follow-up commit', 'merging main'],
  'Plugin tests leave out untracked files': ['plugin tests', 'git stash create', 'untracked', 'git add'],
  'A background run owns its checkout': ['background', 'stash', 'check out', 'switch branches', 'worktree'],
  'The project files folder is a network mount': ['/mnt/project-files', 'hard links', 'worktree', 'dubious ownership'],
  'PR events that run nothing': ['never be woken', 'no `ci` run', 'BASE_SHA']
};

const VERIFYING = {
  'Command shapes that drop work': ['--test-reporter', 'without `--test` runs only', 'claude -p --allowedTools', 'variadic', 'stdin'],
  'Transcripts in evidence': ['extract', 'never the raw file', 'email'],
  'The base side, without history': ['depth 1', 'record its answers with a script', 'to-base.diff', 'apply it in a clone',
    'copying `plan/`', '`scripts/`']
};

for (const [file, want] of [['docs/traps.md', TRAPS], ['docs/verifying.md', VERIFYING]]) {
  const got = sections(file);
  for (const [heading, terms] of Object.entries(want)) {
    test(`${file} "${heading}" carries its terms`, () => {
      assert.ok(heading in got, `${file} has no section "${heading}"`);
      assert.deepEqual(lacking(got[heading], terms), []);
    });
  }
}

test('neither notes file writes up a trap that code removed', () => {
  for (const file of ['docs/traps.md', 'docs/verifying.md']) {
    const text = read(file);
    for (const term of [/npm ci/i, /NODE_TEST_CONTEXT/, /verified_sha/, /trailer/i, /already released/i]) {
      assert.doesNotMatch(text, term, `${file} names ${term}`);
    }
  }
});
