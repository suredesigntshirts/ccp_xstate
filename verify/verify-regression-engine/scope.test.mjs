// scope: between the base and the verified head the PR touches only test/regression/, the 26 suites' folders and the
// item file, except that a file in another verify/ folder changes only a path to a file the PR moved to
// test/regression/fixtures/; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ITEM, SUITES, VERIFIED, git, haveCommits, show } from './lib.mjs';

const inScope = (p) => p.startsWith('test/regression/') || p === ITEM || SUITES.some((s) => p.startsWith(`verify/${s}/`));

/** [status, from, to] per changed path, renames found. */
const changes = () => git(['diff', '-M', '--name-status', BASE, VERIFIED]).split('\n').filter(Boolean).map((l) => l.split('\t'));

/** Whether `after` is `before` with only paths in `moved` (old -> new) swapped. */
export const onlyPathsChanged = (before, after, moved) => before !== after && Object.entries(moved).reduce((s, [a, b]) => s.split(a).join(b), before) === after;

test('scope: every changed path is in scope, or another folder\'s file whose only change is a moved fixture\'s path', (t) => {
  if (!haveCommits()) return t.skip('base or head not readable here');
  const rows = changes();
  assert.ok(rows.length > 100, `${rows.length} changes`);
  const moved = Object.fromEntries(rows.filter(([s, , to]) => s.startsWith('R') && to?.startsWith('test/regression/fixtures/')).map(([, from, to]) => [from, to]));
  const outside = [];
  for (const [status, a, b] of rows) {
    for (const p of [a, b].filter(Boolean)) {
      if (inScope(p)) continue;
      assert.ok(p.startsWith('verify/'), `${status} ${p} is outside test/regression/, the 26 folders and the item`);
      assert.equal(status, 'M', `${p} outside the 26 folders is only modified`);
      assert.ok(onlyPathsChanged(show(BASE, p), show(VERIFIED, p), moved), `${p} changes only paths of moved fixtures`);
      outside.push(p);
    }
  }
  t.diagnostic(`outside the 26 folders: ${outside.join(', ') || 'none'}; fixtures moved: ${Object.keys(moved).length}`);
});

test('scope: nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes', (t) => {
  if (!haveCommits()) return t.skip('base or head not readable here');
  assert.equal(git(['diff', '--name-only', BASE, VERIFIED, '--', 'packages', 'plugins', 'workflows', 'scripts', 'bench']).trim(), '');
});

test('scope: the path check refuses any other change (control)', () => {
  const moved = { 'verify/a/x.jsonl': 'test/regression/fixtures/x.jsonl' };
  assert.ok(onlyPathsChanged("p = 'verify/a/x.jsonl'", "p = 'test/regression/fixtures/x.jsonl'", moved));
  assert.ok(!onlyPathsChanged("p = 'verify/a/x.jsonl'", "p = 'test/regression/fixtures/x.jsonl'; q = 1", moved));
  assert.ok(!onlyPathsChanged('same', 'same', moved));
  assert.ok(!inScope('packages/engine/src/host.js') && !inScope('verify/harness-glossary/lib.mjs') && inScope('verify/wf-intake/verdict.json'));
});
