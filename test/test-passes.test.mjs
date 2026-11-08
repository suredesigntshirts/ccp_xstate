// npm test runs in two passes: a parallel pass over every test file, and after it a serial pass, one test at a time,
// for the tests that measure wall time, which a busy machine would slow. A test joins the serial pass by a name that
// starts with "cheap: "; the parallel pass skips those by the same pattern, so each test runs in exactly one pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const ROOTS = ['test', 'scripts', 'packages', 'plugins', 'verify'];
const script = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts.test;
const [parallel, serial, ...rest] = script.split(' && ');
const flag = (cmd, name) => cmd.match(new RegExp(`--${name}=(?:"([^"]*)"|(\\S+))`))?.slice(1).find((v) => v !== undefined);
const files = (cmd) => [...cmd.matchAll(/(?:^|\s)("?)([^\s"-][^\s"]*)\1(?=\s|$)/g)].map((m) => m[2]).filter((t) => t !== 'node');

test('npm test is a parallel pass, then a serial pass, both node --test', () => {
  assert.equal(rest.length, 0, script);
  assert.match(parallel, /^node --test /);
  assert.match(serial, /^node --test /);
  assert.equal(flag(parallel, 'test-concurrency'), undefined, 'the parallel pass keeps the default concurrency');
  assert.equal(flag(serial, 'test-concurrency'), '1');
});

test('the serial pass runs only the tests the parallel pass skips', () => {
  const pattern = flag(parallel, 'test-skip-pattern');
  assert.equal(pattern, '^cheap: ');
  assert.equal(flag(serial, 'test-name-pattern'), pattern);
  assert.deepEqual(files(parallel), ROOTS.map((r) => (r === 'test' || r === 'scripts' ? `${r}/**/*.test.mjs` : `${r}/**/*.test.{js,mjs}`)));
});

test('every test named "cheap: " is in a file the serial pass runs', () => {
  const held = [];
  for (const root of ROOTS) {
    for (const rel of readdirSync(join(REPO, root), { recursive: true })) {
      if (rel.split('/').includes('node_modules') || !/\.test\.m?js$/.test(rel)) continue;
      if (/\btest\(\s*['"`]cheap: /.test(readFileSync(join(REPO, root, rel), 'utf8'))) held.push(`${root}/${rel}`);
    }
  }
  assert.ok(held.length > 0, 'no test is named "cheap: "');
  assert.deepEqual(held.filter((f) => !files(serial).includes(f)), [], 'files with a "cheap: " test the serial pass does not run');
});
