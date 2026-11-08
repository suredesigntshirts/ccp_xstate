// Expect tests-bite: test/docs.test.mjs goes red when the scripts/gates/ entry is taken out of CLAUDE.md's Layout
// table, and green again when restored. The table groups the scripts/ folders in one row, so the entry is the
// "`scripts/gates/` the PR gates; " clause of that row; the whole row out is tried too. Every edit is in a temp copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { counts, docsCopy, docsTest } from './lib.mjs';

function bite(t, dir, broken) {
  const p = join(dir, 'CLAUDE.md');
  const text = readFileSync(p, 'utf8');
  const green = docsTest(dir);
  assert.equal(green.status, 0, green.out);
  const changed = broken(text);
  assert.notEqual(changed, text, 'the mutation changed CLAUDE.md');
  writeFileSync(p, changed);
  const red = docsTest(dir);
  writeFileSync(p, text);
  const again = docsTest(dir);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  assert.equal(again.status, 0, again.out);
  return red.out;
}

test("docs.test.mjs goes red when scripts/gates/ leaves the Layout table's scripts row", (t) => {
  const dir = docsCopy(t);
  const red = bite(t, dir, (s) => s.replace('`scripts/gates/` the PR gates; ', ''));
  assert.match(red, /scripts\/gates/);
});

test("docs.test.mjs goes red when the Layout table's scripts/ row leaves", (t) => {
  const dir = docsCopy(t);
  const red = bite(t, dir, (s) => s.split('\n').filter((l) => !l.startsWith('| `scripts/`')).join('\n'));
  assert.match(red, /scripts\/gates/);
});
