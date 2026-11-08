// Expect link-refused: a PR branch adding a symlink under verify/ (to a 100 KB file outside verify/, and to a small
// file) or a submodule entry makes the evidence gate exit 1 naming the path and its kind; a regular small file exits 0.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KB, gateRepo } from './lib.mjs';

const BIG = 'x'.repeat(100 * KB);

for (const [name, target] of [['a 100 KB file outside verify/', '../../../data/big.bin'], ['a small file', '../../../data/small.txt']]) {
  test(`a symlink under verify/ to ${name} is refused, naming the path and "symlink"`, (t) => {
    const r = gateRepo(t, { 'data/big.bin': BIG, 'data/small.txt': 'hi\n' });
    r.branch('pr');
    r.commit({}, { 'verify/x/evidence/a.md': target });
    assert.equal(r.git('ls-tree', 'HEAD', '--', 'verify/x/evidence/a.md').split(/\s/)[0], '120000', 'committed as a symlink');
    const out = r.evidence();
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /verify\/x\/evidence\/a\.md is a symlink/);
    t.diagnostic(out.out.trim().split('\n').find((l) => l.includes('a.md')));
  });
}

test('a submodule entry under verify/ is refused, naming the path and "submodule"', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.git('update-index', '--add', '--cacheinfo', `160000,${r.base},verify/x/sub`);
  r.git('-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'submodule');
  assert.equal(r.git('ls-tree', 'HEAD', '--', 'verify/x/sub').split(/\s/)[0], '160000');
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/sub is a submodule/);
  t.diagnostic(out.out.trim().split('\n').find((l) => l.includes('verify/x/sub')));
});

test('a regular small evidence file under verify/ passes', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/evidence/a.md': 'Command: node --test x\nExcerpt: 3 pass\n' });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});
