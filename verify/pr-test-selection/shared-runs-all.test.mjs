// shared-runs-all: a change to a file every guard shares, or to a file no guard reaches outside the folders no guard
// needs, selects every guard. Made-up changes, run through the head's selector over the head's own tree.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO, selector } from './lib.mjs';

const graph = selector.reaches(REPO);
const all = (changed) => selector.select(changed, { repo: REPO, graph }).all === true;

test('shared-runs-all: package.json, package-lock.json, ci.yml and the selector each select every guard', () => {
  for (const f of ['package.json', 'package-lock.json', '.github/workflows/ci.yml', 'scripts/ci/select-tests.mjs']) {
    assert.ok(all([f]), f);
    assert.ok(all(['plan/items/pr-test-selection.md', f]), `${f} beside a plan file`);
  }
});

test('shared-runs-all: a new file no guard names, outside plan/ docs/ bench/ tournaments/ verify/, selects every guard', () => {
  for (const f of ['infra/new-thing.sh', 'a-new-top-level-file.txt', 'vendor/new-tool/x.js']) {
    assert.ok(all([f]), f);
  }
});

test('shared-runs-all: a tracked file no guard reaches, outside the inert folders, selects every guard', () => {
  const inert = ['plan/', 'docs/', 'bench/', 'tournaments/', 'verify/', 'probes/'];
  const reached = new Set();
  for (const r of graph.reach.values()) for (const p of r) reached.add(p);
  const under = (f) => { for (let d = f; d.includes('/');) { d = d.slice(0, d.lastIndexOf('/')); if (reached.has(d)) return true; } return false; };
  const lonely = [...selector.changedFiles('4b825dc642cb6eb9a060e54bf8d69288fbee4904', 'HEAD', REPO)]
    .filter((f) => !inert.some((d) => f.startsWith(d)) && !reached.has(f) && !under(f));
  for (const f of lonely) assert.ok(all([f]), f);
  console.log(`${lonely.length} tracked files no guard reaches outside the inert folders, each selects every guard`);
  assert.ok(lonely.length > 0, 'the head has tracked files no guard reaches, so this case is live');
});

test('shared-runs-all: a file under the inert folders that no guard reads selects none and is not run for', () => {
  const r = selector.select(['plan/items/pr-test-selection.md', 'tournaments/README.md'], { repo: REPO, graph });
  assert.equal(r.all, false);
});
