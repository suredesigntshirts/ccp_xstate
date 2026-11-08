// Expect map-complete: every top-level folder (dot folders other than .github, node_modules and .git excepted) and
// every folder under scripts/ is named in backticks in CLAUDE.md's Layout table, docs/layout.md holds no fenced folder
// tree, and the docs test passes; with a new folder scripts/x in a temp copy, test/docs.test.mjs fails naming it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, counts, docsCopy, docsTest, folders, layoutTokens, named, read } from './lib.mjs';

test("CLAUDE.md's Layout table names every top-level folder and every scripts/ folder", (t) => {
  const tokens = layoutTokens();
  const all = folders();
  t.diagnostic(`${all.length} folders: ${all.join(', ')}`);
  assert.ok(all.includes('scripts/gates') && all.includes('.github') && all.includes('probes'), all.join(', '));
  assert.deepEqual(all.filter((f) => !named(f, tokens)), []);
});

test('docs/layout.md holds no fenced folder tree and points at the Layout table', () => {
  const text = read('docs/layout.md');
  const fences = [...text.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1]);
  const treeLines = fences.flatMap((f) => f.split('\n')).filter((l) => /^\s*[\w.<>-]+\/(\S*)?\s/.test(l) || /^[├└│]/.test(l));
  assert.deepEqual(treeLines, [], 'a fenced folder tree is left');
  assert.match(text, /CLAUDE\.md/);
  assert.match(text, /Layout/);
  for (const h of ['## Tests', '## Comments', '## Dependencies']) assert.ok(text.includes(h), `${h} kept`);
});

test('test/docs.test.mjs passes at the head', (t) => {
  const r = docsTest(REPO);
  t.diagnostic(JSON.stringify(counts(r.out)));
  assert.equal(r.status, 0, r.out);
});

test('test/docs.test.mjs fails naming scripts/x when that folder is added', (t) => {
  const dir = docsCopy(t);
  const green = docsTest(dir);
  assert.equal(green.status, 0, green.out);
  mkdirSync(join(dir, 'scripts/x'));
  writeFileSync(join(dir, 'scripts/x/a.mjs'), '// a\n');
  const red = docsTest(dir);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, with scripts/x ${JSON.stringify(counts(red.out))}`);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  assert.match(red.out, /scripts\/x/);
  t.diagnostic(red.out.split('\n').filter((l) => /scripts\/x/.test(l)).slice(0, 3).join(' | '));
});
