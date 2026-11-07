// Expect one-place: outside names.js, tests and vendor/, no file under packages/, plugins/ or scripts/ holds the run id
// pattern, the safe pattern, or a sorted-keys JSON hash.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO } from './lib.mjs';

const SKIP = new Set(['node_modules', 'vendor', 'test', '.git']);
function* files(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (!SKIP.has(n)) yield* files(p); } else if (/\.(m?js|cjs|sh|py)$/.test(n) && !/\.test\./.test(n)) yield p;
  }
}
const PATTERNS = {
  runId: ':(\\d+\\.[\\w-]+)$',
  safe: '[^A-Za-z0-9._-]',
  // A sorted-keys serialisation: Object.keys(..).sort() feeding JSON.stringify or a hash.
  sortedHash: /Object\.keys\([^)]*\)\.sort\(\)\.map\(\(\w+\) => \[\w+, \w+\(/
};

test('one-place: the run id, safe and sorted-hash patterns are only in names.js', (t) => {
  const hits = [];
  for (const top of ['packages', 'plugins', 'scripts']) for (const f of files(join(REPO, top))) {
    const rel = relative(REPO, f);
    const text = readFileSync(f, 'utf8');
    for (const [k, p] of Object.entries(PATTERNS)) if (typeof p === 'string' ? text.includes(p) : p.test(text)) hits.push(`${k} ${rel}`);
  }
  t.diagnostic(hits.join('; '));
  assert.deepEqual(hits.sort(), ['runId packages/engine/src/names.js', 'safe packages/engine/src/names.js', 'sortedHash packages/engine/src/names.js']);
});
