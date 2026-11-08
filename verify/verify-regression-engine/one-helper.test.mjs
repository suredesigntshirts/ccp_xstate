// one-helper: the only .mjs or .js file under test/regression/ that is not a test file is lib.mjs, and every name it
// exports is imported by at least two test files there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { REPO, walk } from './lib.mjs';

const ROOT = join(REPO, 'test', 'regression');
const LIB = join(ROOT, 'lib.mjs');

/** The names a module exports: export const/let/function/class X, and export { a, b as c }. */
export function exportsOf(text) {
  const out = new Set();
  for (const m of text.matchAll(/^export\s+(?:async\s+)?(?:const|let|var|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) out.add(m[1]);
  for (const m of text.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop(); if (n) out.add(n); }
  return out;
}

/** The names a file takes from `lib`: static `import { ... } from`, `const { ... } = await import(...)`, and ns.x for `import * as ns`. */
export function importsFrom(text, file, lib) {
  const names = new Set();
  const isLib = (spec) => spec.startsWith('.') && resolve(dirname(file), spec) === lib;
  const take = (list) => { for (const part of list.split(',')) { const n = part.trim().split(/\s+as\s+|\s*:\s*/)[0].trim(); if (n) names.add(n); } };
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) if (isLib(m[2])) take(m[1]);
  for (const m of text.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(\s*['"]([^'"]+)['"]\s*\)/g)) if (isLib(m[2])) take(m[1]);
  for (const m of text.matchAll(/import\s*\*\s*as\s+(\w+)\s+from\s*['"]([^'"]+)['"]/g)) {
    if (!isLib(m[2])) continue;
    for (const u of text.matchAll(new RegExp(`\\b${m[1]}\\.([A-Za-z_$][\\w$]*)`, 'g'))) names.add(u[1]);
  }
  return names;
}

test('one-helper: lib.mjs is the only code file under test/regression/ that is not a test file', () => {
  const code = walk(ROOT).filter((p) => /\.(mjs|js|cjs)$/.test(p) && !p.endsWith('.test.mjs'));
  assert.deepEqual(code, ['test/regression/lib.mjs']);
});

test('one-helper: every name lib.mjs exports is imported by at least two test files', (t) => {
  const exported = exportsOf(readFileSync(LIB, 'utf8'));
  assert.ok(exported.size > 0);
  const tests = walk(ROOT).filter((p) => p.endsWith('.test.mjs'));
  const users = Object.fromEntries([...exported].map((n) => [n, []]));
  for (const f of tests) {
    const abs = join(REPO, f);
    for (const n of importsFrom(readFileSync(abs, 'utf8'), abs, LIB)) if (n in users) users[n].push(f);
  }
  for (const [n, fs] of Object.entries(users)) assert.ok(fs.length >= 2, `${n} is imported by ${fs.length}: ${fs.join(', ')}`);
  t.diagnostic(`${exported.size} exports; fewest importers ${Math.min(...Object.values(users).map((u) => u.length))}`);
});

test('one-helper: the parsers see every export and import form (control)', () => {
  const lib = '/r/test/regression/lib.mjs';
  assert.deepEqual([...exportsOf('export const A = 1;\nexport async function f() {}\nexport { x, y as z };\nconst q = 2;')].sort(), ['A', 'f', 'x', 'z']);
  const text = "import { A, b as c } from '../lib.mjs';\nconst { d } = await import('../lib.mjs');\nimport * as L from '../lib.mjs';\nL.e(); import { g } from '../other.mjs';";
  assert.deepEqual([...importsFrom(text, '/r/test/regression/engine/x.test.mjs', lib)].sort(), ['A', 'b', 'd', 'e']);
});
