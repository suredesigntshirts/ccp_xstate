// leanClone (test/regression/lib.mjs): a working clone of the repo checked out without bench/ and tournaments/, with
// the refs, HEAD and tracked files a plain clone of the same source has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { leanClone } from '../lib.mjs';

const REPO = join(import.meta.dirname, '..', '..', '..');
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9 });
const sorted = (s) => s.split('\n').filter(Boolean).sort();

function onDisk(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (d === dir && e.name === '.git') continue;
      if (e.isDirectory()) walk(join(d, e.name));
      else out.push(relative(dir, join(d, e.name)));
    }
  };
  walk(dir);
  return out.sort();
}

test('a lean clone of a bare clone has every tracked file but bench/ and tournaments/ on disk, and the source\'s refs and HEAD', (t) => {
  const d = mkdtempSync(join(tmpdir(), 'lean-clone-'));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  const origin = join(d, 'origin.git');
  git(REPO, 'clone', '-q', '--bare', REPO, origin);
  git(origin, 'tag', 'lean-check', 'HEAD');
  const lean = leanClone(origin, join(d, 'lean'));

  const tracked = sorted(git(origin, 'ls-tree', '-r', '--name-only', 'HEAD'));
  const kept = tracked.filter((p) => !/^(bench|tournaments)\//.test(p));
  assert.ok(kept.length < tracked.length, 'the repo tracks files under bench/ or tournaments/');
  assert.deepEqual(sorted(git(lean, 'ls-files')), tracked, 'the index tracks every file');
  assert.deepEqual(onDisk(lean), kept, 'on disk: every tracked file outside bench/ and tournaments/');
  assert.equal(git(lean, 'status', '--porcelain'), '', 'reads as clean');

  assert.equal(git(lean, 'rev-parse', 'HEAD'), git(origin, 'rev-parse', 'HEAD'));
  const branches = sorted(git(origin, 'for-each-ref', '--format=%(refname:lstrip=2) %(objectname)', 'refs/heads'));
  const remotes = sorted(git(lean, 'for-each-ref', '--format=%(refname:lstrip=3) %(objectname)', 'refs/remotes/origin')).filter((l) => !l.startsWith('HEAD '));
  assert.deepEqual(remotes, branches, 'every branch of the source, at the same commit');
  assert.deepEqual(sorted(git(lean, 'tag')), sorted(git(origin, 'tag')), 'every tag of the source');
  assert.equal(git(lean, 'rev-list', '--count', 'HEAD'), git(origin, 'rev-list', '--count', 'HEAD'), 'the whole history');
});
