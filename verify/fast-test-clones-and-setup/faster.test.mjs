// faster: run alone on the same machine, the summed test time of no-self-edit.test.mjs, self-edit-check.test.mjs and
// test/setup.test.mjs at the head is at most 60% of the same sum at the base. The timing itself is record.mjs's,
// run alone at base and head, alternating, three rounds (evidence/faster.md): a wall-clock bar inside npm test's
// parallel pass would measure the other files' load. Here, the cause by count, not by clock: what a lean clone checks
// out against a plain clone (the npm side is skills-switch's).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { REPO, run, temp } from './lib.mjs';
import { leanClone } from '../../test/regression/lib.mjs';

test('faster: a lean clone of the repo checks out under a sixth of the files a plain clone does', (t) => {
  const lean = leanClone(REPO, join(temp('count'), 'lean'));
  // A plain clone checks out every tracked file; the lean clone's index marks the left-out ones skip-worktree (S).
  const entries = run(lean, ['ls-files', '-t']).split('\n').filter(Boolean);
  const all = run(REPO, ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').filter(Boolean).length;
  const onDisk = entries.filter((l) => l.startsWith('H ')).length;
  t.diagnostic(`plain: ${all} files to check out; lean: ${onDisk} (${entries.length - onDisk} left out)`);
  assert.equal(entries.length, all, 'the lean index tracks every file');
  assert.ok(onDisk > 0);
  assert.ok(onDisk * 6 < all, `${onDisk} of ${all}`);
});
