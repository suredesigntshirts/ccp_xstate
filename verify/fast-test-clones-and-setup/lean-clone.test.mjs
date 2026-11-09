// lean-clone: the helper's clone of the repo holds no file under bench/ or tournaments/ on disk, holds every other
// tracked file, and has the same HEAD sha, branches and tags a plain git clone of the same source has.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO, run, temp } from './lib.mjs';
import { leanClone } from '../../test/regression/lib.mjs';

const lines = (s) => s.split('\n').filter(Boolean).sort();
const LEFT_OUT = /^(bench|tournaments)\//;

/** Every file and symlink on disk under `dir`, .git aside, repo-relative. */
function onDisk(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === '.git' && d === dir) continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(dir, p));
    }
  };
  walk(dir);
  return out.sort();
}

function compare(t, src) {
  const d = temp('lean');
  const lean = leanClone(src, join(d, 'lean'));
  const plain = join(d, 'plain');
  run(d, ['clone', '-q', src, plain]);
  const tracked = lines(run(plain, ['ls-files']));
  assert.deepEqual(lines(run(lean, ['ls-files'])), tracked, 'the same tracked files');
  const kept = tracked.filter((p) => !LEFT_OUT.test(p));
  assert.ok(tracked.length > kept.length, 'the source tracks files under bench/ or tournaments/');
  assert.deepEqual(onDisk(lean), kept, 'on disk: every tracked file outside bench/ and tournaments/, and nothing else');
  assert.deepEqual(onDisk(plain), tracked, 'the plain clone checks out every tracked file');
  for (const args of [['rev-parse', 'HEAD'], ['branch', '-a'], ['tag'], ['for-each-ref', '--format=%(refname) %(objectname)'], ['rev-list', '--count', 'HEAD']]) {
    assert.equal(run(lean, args), run(plain, args), `git ${args.join(' ')}`);
  }
  assert.equal(run(lean, ['status', '--porcelain']), '', 'the lean clone reads as clean');
  t.diagnostic(`${tracked.length} tracked, ${kept.length} on disk in the lean clone; HEAD ${run(lean, ['rev-parse', 'HEAD']).trim()}`);
}

test('lean-clone: a clone of the checkout matches a plain clone in files kept, HEAD, branches and tags', (t) => {
  compare(t, REPO);
});

test('lean-clone: a clone of a bare clone of the checkout matches a plain clone of it the same way', (t) => {
  const bare = join(temp('bare'), 'origin.git');
  run(REPO, ['clone', '-q', '--bare', REPO, bare]);
  run(bare, ['tag', 'v-lean-check', 'HEAD']);
  compare(t, bare);
});
