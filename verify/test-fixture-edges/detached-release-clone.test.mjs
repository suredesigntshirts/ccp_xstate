// detached-release-clone: copy-not-link and no-self-edit in a clone whose HEAD is detached at a commit no other
// branch points at, with a local release/harness-v9.9.9 branch at that same commit.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cleanup, clone, git, nodeTest } from './lib.mjs';

after(cleanup);
const FILES = ['test/setup.test.mjs', 'verify/self-update-by-version/no-self-edit.test.mjs'];

function detachedWithRelease(name, opts) {
  const dir = clone(name, opts);
  git(dir, 'checkout', '-q', '--detach');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'a commit only the release branch points at');
  git(dir, 'branch', 'release/harness-v9.9.9');
  const at = git(dir, 'rev-parse', 'HEAD');
  const pointing = git(dir, 'for-each-ref', '--points-at', at, '--format=%(refname)').split('\n').filter(Boolean);
  assert.deepEqual(pointing, ['refs/heads/release/harness-v9.9.9']);
  assert.equal(headName(dir), 'HEAD', 'HEAD is detached');
  return dir;
}
const headName = (dir) => git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');

test('at the head every copy-not-link and no-self-edit test passes, none skipped', (t) => {
  const r = nodeTest(detachedWithRelease('head'), FILES);
  t.diagnostic(`pass ${r.pass} fail ${r.fail} skipped ${r.skipped}`);
  assert.equal(r.fail, 0, r.failed.join('\n') + r.out.slice(-3000));
  assert.equal(r.skipped, 0);
  assert.ok(r.pass >= 12, `pass ${r.pass}`);
  assert.equal(r.status, 0);
});

test('with the build change taken out, a copy-not-link and a no-self-edit test fail on HEAD', (t) => {
  const r = nodeTest(detachedWithRelease('base', { base: true }), FILES);
  t.diagnostic(`pass ${r.pass} fail ${r.fail} skipped ${r.skipped}; failed: ${r.failed.join(' | ')}`);
  assert.ok(r.failed.some((n) => n.startsWith('copy-not-link')), r.failed.join('\n'));
  assert.ok(r.failed.some((n) => !n.startsWith('copy-not-link') && !/\.test\.mjs$/.test(n)), r.failed.join('\n'));
  assert.match(r.out, /Failed to resolve 'HEAD'/);
});
