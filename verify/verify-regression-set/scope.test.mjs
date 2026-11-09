// scope: between the base and the verified head the PR touches only test/regression/, the retired verify/ folders and
// the item file; outside them only a not-done item's verify/ file that re-points or drops a read of a gone file, or
// docs/traps.md dropping only the name of a test file the PR deletes; nothing under packages/, plugins/, workflows/,
// scripts/ or bench/ changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ID, ITEM, VERIFIED, doneAtBase, git, gitDir, show } from './lib.mjs';

/** [status, from, to] per changed path, renames found. */
const changes = () => git(['diff', '-M', '--name-status', BASE, VERIFIED]).split('\n').filter(Boolean).map((l) => l.split('\t'));

/** Whether the diff from `before` to `after` only re-points moved paths or drops lines naming deleted paths. */
export function onlyDropsOrRepoints(before, after, moved, deleted) {
  if (before === after) return false;
  const swap = (s) => Object.entries(moved).reduce((x, [a, b]) => x.split(a).join(b), s);
  const b = after.split('\n');
  let j = 0;
  for (const line of before.split('\n')) {
    if (j < b.length && swap(line) === b[j]) { j++; continue; }
    if (!deleted.some((p) => line.includes(p))) return false;
  }
  return j === b.length;
}

/** A trap example: "; `verify/<x>.test.mjs` does this" before a sentence's full stop. */
const EXAMPLE = /[;,]\s*`(verify\/[^`]+\.test\.(?:mjs|js))`[^.`]*(?=\.)/g;

/**
 * Whether docs/traps.md's change only drops example names of deleted test files: the two texts are the same once
 * every such example of a deleted file is taken out of the old one, and at least one was.
 */
export function onlyDropsExamples(before, after, deleted) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const names = [...before.matchAll(EXAMPLE)].map((m) => m[1]);
  const gone = names.filter((p) => !after.includes(p));
  if (!gone.length || gone.some((p) => !deleted.includes(p))) return false;
  const stripped = before.replace(EXAMPLE, (m, p) => (gone.includes(p) ? '' : m));
  return norm(stripped) === norm(after);
}

test('scope: every changed path is in scope, or an allowed change outside it', (t) => {
  if (!gitDir()) return t.skip('base or head not readable here');
  const retired = doneAtBase();
  const inScope = (p) => p.startsWith('test/regression/') || p === ITEM || p.startsWith(`verify/${ID}/`) || retired.some((s) => p.startsWith(`verify/${s}/`));
  const rows = changes();
  assert.ok(rows.length > 100, `${rows.length} changes`);
  const moved = Object.fromEntries(rows.filter(([s]) => s.startsWith('R')).map(([, from, to]) => [from, to]));
  const deleted = rows.filter(([s]) => s === 'D').map(([, p]) => p).concat(Object.keys(moved));
  const outside = [];
  for (const [status, a, b] of rows) {
    for (const p of [a, b].filter(Boolean)) {
      if (inScope(p)) continue;
      assert.equal(status, 'M', `${status} ${p} outside the scope is only modified`);
      if (p === 'docs/traps.md') {
        assert.ok(onlyDropsExamples(show(BASE, p), show(VERIFIED, p), deleted), 'docs/traps.md only drops names of deleted test files');
      } else {
        assert.ok(p.startsWith('verify/'), `${p} is outside test/regression/, the retired folders and the item`);
        assert.ok(onlyDropsOrRepoints(show(BASE, p), show(VERIFIED, p), moved, deleted), `${p} only re-points or drops reads of gone files`);
      }
      outside.push(p);
    }
  }
  t.diagnostic(`outside the retired folders, test/regression/ and the item: ${outside.join(', ') || 'none'}; ${rows.filter(([s]) => s === 'D').length} deleted, ${Object.keys(moved).length} renamed, ${rows.length} changes`);
});

test('scope: nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes', (t) => {
  if (!gitDir()) return t.skip('base or head not readable here');
  assert.equal(git(['diff', '--name-only', BASE, VERIFIED, '--', 'packages', 'plugins', 'workflows', 'scripts', 'bench']).trim(), '');
});

test('scope: the checks refuse any other change (control)', () => {
  const gone = ['verify/a/x.test.mjs'];
  const before = 'one `.lock`; `verify/a/x.test.mjs` does this.\n\nTwo, from the tree; `verify/b/y.test.mjs` does this.\n';
  assert.ok(onlyDropsExamples(before, 'one `.lock`.\n\nTwo, from the tree; `verify/b/y.test.mjs` does this.\n', gone));
  assert.ok(!onlyDropsExamples(before, 'one `.lock`.\n\nTwo, from the tree.\n', gone), 'dropping a live file\'s name');
  assert.ok(!onlyDropsExamples(before, 'one `.lock`, reworded.\n\nTwo, from the tree; `verify/b/y.test.mjs` does this.\n', gone), 'rewording');
  assert.ok(!onlyDropsExamples(before, before, gone), 'no change');
  assert.ok(onlyDropsOrRepoints("a\nread('verify/a/x.test.mjs')\nb", 'a\nb', {}, gone));
  assert.ok(!onlyDropsOrRepoints('a\nb', 'a\nb\nextra()', {}, gone), 'adding a line');
  assert.ok(onlyDropsOrRepoints("p = 'verify/a/j.jsonl'", "p = 'test/regression/fixtures/j.jsonl'", { 'verify/a/j.jsonl': 'test/regression/fixtures/j.jsonl' }, []));
});
