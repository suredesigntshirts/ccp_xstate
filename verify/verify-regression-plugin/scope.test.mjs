// scope: between the base and the verified head the PR touches only test/regression/, the 19 suites' folders and the
// item file, except that a file in another verify/ folder changes only so it reads a moved file's new path or no
// longer reads a file the PR deleted; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ITEM, SUITES, VERIFIED, git, haveCommits, show } from './lib.mjs';

const inScope = (p) => p.startsWith('test/regression/') || p === ITEM || SUITES.some((s) => p.startsWith(`verify/${s}/`));

/** [status, from, to] per changed path, renames found. */
const changes = () => git(['diff', '-M', '--name-status', BASE, VERIFIED]).split('\n').filter(Boolean).map((l) => l.split('\t'));

/** Literal strings a file binds to a const array, by name: const NAME = ['a', 'b']. */
const arrays = (text) => Object.fromEntries([...text.matchAll(/const\s+(\w+)\s*=\s*\[([^\]]*)\]/g)].map(([, n, body]) => [n, [...body.matchAll(/'([^']+)'/g)].map((m) => m[1])]));

/**
 * Whether the diff from `before` to `after` only re-points or drops reads of gone files: every added line is a removed
 * line with moved paths swapped, and every other removed line names a deleted path, literally or as NAME[i] of a
 * const array of paths.
 */
export function onlyDropsOrRepoints(before, after, moved, deleted) {
  if (before === after) return false;
  const swap = (s) => Object.entries(moved).reduce((x, [a, b]) => x.split(a).join(b), s);
  const a = before.split('\n'), b = after.split('\n');
  const bound = arrays(before);
  const namesGone = (l) => deleted.some((p) => l.includes(p)) ||
    [...l.matchAll(/(\w+)\[(\d+)\]/g)].some(([, n, i]) => deleted.includes(bound[n]?.[Number(i)]));
  // walk both line lists in order; lines of `after` must appear in `before` (swapped), the skipped ones must name gone files
  let j = 0;
  for (const line of a) {
    if (j < b.length && swap(line) === b[j]) { j++; continue; }
    if (!namesGone(line)) return false;
  }
  return j === b.length;
}

test('scope: every changed path is in scope, or another folder\'s file that only re-points or drops a gone file', (t) => {
  if (!haveCommits()) return t.skip('base or head not readable here');
  const rows = changes();
  assert.ok(rows.length > 100, `${rows.length} changes`);
  const moved = Object.fromEntries(rows.filter(([s]) => s.startsWith('R')).map(([, from, to]) => [from, to]));
  const deleted = rows.filter(([s]) => s === 'D').map(([, p]) => p);
  const outside = [];
  for (const [status, a, b] of rows) {
    for (const p of [a, b].filter(Boolean)) {
      if (inScope(p)) continue;
      assert.ok(p.startsWith('verify/'), `${status} ${p} is outside test/regression/, the 19 folders and the item`);
      assert.equal(status, 'M', `${p} outside the 19 folders is only modified`);
      assert.ok(onlyDropsOrRepoints(show(BASE, p), show(VERIFIED, p), moved, deleted), `${p} only re-points or drops reads of gone files`);
      outside.push(p);
    }
  }
  t.diagnostic(`outside the 19 folders: ${outside.join(', ') || 'none'}; ${deleted.length} deleted, ${Object.keys(moved).length} renamed`);
});

test('scope: nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes', (t) => {
  if (!haveCommits()) return t.skip('base or head not readable here');
  assert.equal(git(['diff', '--name-only', BASE, VERIFIED, '--', 'packages', 'plugins', 'workflows', 'scripts', 'bench']).trim(), '');
});

test('scope: the diff check refuses any other change (control)', () => {
  const gone = ['verify/a/x.test.mjs'];
  const before = "const T = ['verify/a/x.test.mjs', 'verify/b/y.test.mjs'];\nassert(read(T[0]));\nassert(read(T[1]));\n";
  assert.ok(onlyDropsOrRepoints(before, "const T = ['verify/a/x.test.mjs', 'verify/b/y.test.mjs'];\nassert(read(T[1]));\n", {}, gone));
  assert.ok(!onlyDropsOrRepoints(before, "const T = ['verify/a/x.test.mjs', 'verify/b/y.test.mjs'];\nassert(read(T[0]));\n", {}, gone), 'dropping a live read');
  assert.ok(!onlyDropsOrRepoints(before, before + 'extra();\n', {}, gone), 'adding a line');
  assert.ok(onlyDropsOrRepoints("p = 'verify/a/j.jsonl'", "p = 'test/regression/fixtures/j.jsonl'", { 'verify/a/j.jsonl': 'test/regression/fixtures/j.jsonl' }, []));
  assert.ok(!onlyDropsOrRepoints('same', 'same', {}, gone));
  assert.ok(!inScope('plugins/harness/hooks/capture.mjs') && !inScope('verify/rules-said-once/x.test.mjs') && inScope('verify/obs-page/verdict.json'));
});
