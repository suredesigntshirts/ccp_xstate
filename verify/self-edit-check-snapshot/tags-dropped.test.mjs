// tags-dropped: test/setup.test.mjs passes in a clone carrying harness-v tags and a release/harness-v branch newer
// than harness-v0.1.10, and in a clone with no release refs at all.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, SETUP_TEST, cloneHead, git, nodeTest, temp } from './lib.mjs';

const releaseRefs = (c) => git(c, 'for-each-ref', '--format=%(refname)', 'refs/tags/harness-v*', 'refs/heads/release/', 'refs/remotes/origin/release/').split('\n').filter(Boolean);

function clone(t) {
  const c = cloneHead(temp(t, 'tags'));
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  for (const ref of releaseRefs(c)) git(c, 'update-ref', '-d', ref);
  return c;
}

/** A release branch newer than every tag, at a commit of its own (a shallow checkout has no HEAD~1). */
function newerBranch(c) {
  const side = git(c, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'a later release');
  git(c, 'branch', 'release/harness-v3.0.0', side);
}

test('tags-dropped: setup.test.mjs passes in a clone with newer harness-v tags and a newer release branch', (t) => {
  const c = clone(t);
  for (const tag of ['harness-v0.1.11', 'harness-v0.1.40', 'harness-v2.0.0']) git(c, 'tag', tag, 'HEAD');
  newerBranch(c);
  t.diagnostic(`release refs: ${releaseRefs(c).join(' ')}`);
  const r = nodeTest(c, SETUP_TEST);
  assert.deepEqual({ fail: r.fail, skipped: r.skipped }, { fail: 0, skipped: 0 }, r.out.slice(-3000));
  assert.ok(r.pass >= 6);
});

test('tags-dropped: setup.test.mjs passes in a clone with no release refs', (t) => {
  const c = clone(t);
  assert.deepEqual(releaseRefs(c), []);
  const r = nodeTest(c, SETUP_TEST);
  assert.deepEqual({ fail: r.fail, skipped: r.skipped }, { fail: 0, skipped: 0 }, r.out.slice(-3000));
  assert.ok(r.pass >= 6);
});

test('tags-dropped: the same tagged clone with the copy-not-link test as it was before this item goes red', (t) => {
  const c = clone(t);
  for (const tag of ['harness-v0.1.11', 'harness-v0.1.40', 'harness-v2.0.0']) git(c, 'tag', tag, 'HEAD');
  newerBranch(c);
  // The test as it was before this item: the head's file less the lines that drop inherited release refs.
  const p = join(c, SETUP_TEST), src = readFileSync(p, 'utf8');
  const prior = src.split('\n').filter((l) => !/\binherited\b/.test(l)).join('\n');
  assert.equal(src.split('\n').length - prior.split('\n').length, 2, 'the two drop lines removed');
  writeFileSync(p, prior);
  const r = nodeTest(c, SETUP_TEST, { args: ['--test-name-pattern=copy-not-link: with release tags'] });
  t.diagnostic(`without the drop: fail ${r.fail}`);
  assert.equal(r.fail, 1, 'without the drop the inherited newer releases win');
});
