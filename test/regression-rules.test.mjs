// The regression folder's rules and two test-speed rules, read from source text only: every regression test file names
// the Expect lines it holds; none reads under verify/; lib.mjs is its one helper; guards clone the repo only through
// leanClone; and a guard that runs setup.sh skips the docs skill's npm ci unless it tests that install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const read = (rel) => readFileSync(join(REPO, rel), 'utf8');
/** Repo-relative paths of the files under `dir`, node_modules and .git aside. */
function under(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else out.push(relative(REPO, p));
    }
  };
  walk(join(REPO, dir));
  return out.sort();
}
/** The source with whole-line comments dropped, so a comment naming a path is not a read of it. */
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

const REGRESSION = under('test/regression');
const TESTS = REGRESSION.filter((f) => /\.test\.m?js$/.test(f));
const GUARDS = ['test', 'scripts', 'packages', 'plugins'].flatMap(under).filter((f) => /\.m?js$/.test(f));

/** item id -> the ids of its Expect lines. */
function expectIds() {
  const out = new Map();
  for (const f of readdirSync(join(REPO, 'plan', 'items')).filter((n) => n.endsWith('.md'))) {
    const head = read(join('plan', 'items', f)).match(/^```json\n([\s\S]*?)\n```/);
    if (!head) continue;
    const item = JSON.parse(head[1]);
    out.set(item.id, new Set((item.expect ?? []).map((e) => e.id)));
  }
  return out;
}

test('every regression test file opens with an Expect: header naming Expect lines that exist', () => {
  assert.ok(TESTS.length > 50, `${TESTS.length} regression test files`);
  const ids = expectIds();
  const bad = [];
  for (const f of TESTS) {
    const first = read(f).split('\n')[0];
    const m = first.match(/^\/\/ Expect: (.+)$/);
    if (!m) { bad.push(`${f}: no Expect: header on its first line`); continue; }
    for (const ref of m[1].split(',').map((s) => s.trim())) {
      const [item, id] = ref.split('/');
      if (!ids.get(item)?.has(id)) bad.push(`${f}: ${ref} is not an Expect line of a plan item`);
    }
  }
  assert.deepEqual(bad, []);
});

test('no file under test/regression/ reads under verify/', () => {
  // A path into the checkout's verify/: one joined onto REPO or ROOT, or one reached by ../ from the file. Paths a test
  // writes in a temp repo of its own ('verify/<item>/verdict.json' in a gate world) are not reads of the checkout.
  const VERIFY = /join\(\s*(?:REPO|ROOT)\b[^()\n]*['"`]verify(?:\/|['"`])|['"`](?:\.\.\/)+verify\//;
  assert.deepEqual(REGRESSION.filter((f) => /\.m?js$/.test(f) && VERIFY.test(code(read(f)))), []);
});

test('lib.mjs is the one code file under test/regression/ that is not a test file', () => {
  assert.deepEqual(REGRESSION.filter((f) => /\.m?js$/.test(f) && !/\.test\.m?js$/.test(f) && !f.startsWith('test/regression/fixtures/')), ['test/regression/lib.mjs']);
});

test('a guard clones the repo only through leanClone: no plain git clone of REPO or ROOT', () => {
  const PLAIN = /(?:execFileSync|spawnSync|execSync|spawn|git)\(\s*(?:'git',\s*)?\[?\s*(?:'-C',\s*[^,]+,\s*)?'clone',([^\]\n)]*)/g;
  const bad = [];
  for (const f of GUARDS) {
    if (f === 'test/regression/lib.mjs') continue;
    for (const m of code(read(f)).matchAll(PLAIN)) {
      const args = m[1];
      if (/'--bare'|'--mirror'/.test(args)) continue;
      if (/(^|[\s,])(REPO|ROOT)\s*,/.test(args)) bad.push(`${f}: git clone${args}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('a guard that runs setup.sh sets CCP_SETUP_SKILLS, unless it tests the docs skill install', () => {
  const RUNS = /(?:execFileSync|spawnSync|spawn)\(\s*'bash'/;
  const runners = GUARDS.filter((f) => { const c = code(read(f)); return RUNS.test(c) && /setup\.sh/.test(c); });
  assert.ok(runners.length >= 5, `files that run setup.sh: ${runners.join(', ')}`);
  assert.deepEqual(runners.filter((f) => !/\bCCP_SETUP_SKILLS\b/.test(read(f))), []);
});
