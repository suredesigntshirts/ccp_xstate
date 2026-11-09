// no-verify-in-npm-test: npm test at the head starts no test file under verify/, and every test file under test/,
// scripts/, packages/ and plugins/ it started at the base it still starts. The file lists come from expanding each
// pass's patterns over the tracked files (the head's script over the head's tree, the base's over the base's tree);
// evidence/no-verify-in-npm-test.md holds the files two real npm test runs started.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, REPO, ROOTS, VERIFIED, expand, gitDir, lsTree, passes, show, trackedFiles } from './lib.mjs';

const isTest = (f) => /\.test\.(js|mjs)$/.test(f);
const started = (script, tree) => [...new Set(passes(script).flatMap((p) => expand(p, tree)))].sort();
const head = { script: JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts.test, tree: trackedFiles() };
const headFiles = started(head.script, head.tree);

test('no-verify-in-npm-test: neither pass of npm test at the head starts a file under verify/', (t) => {
  assert.ok(headFiles.length > 150, `${headFiles.length} files`);
  assert.deepEqual(headFiles.filter((f) => f.startsWith('verify/')), []);
  const onDisk = head.tree.filter((f) => f.startsWith('verify/') && isTest(f));
  assert.ok(onDisk.length > 0, 'the checkout still holds verify/ test files');
  t.diagnostic(`${headFiles.length} files started; ${onDisk.length} verify/ test files on disk, none started`);
});

test('no-verify-in-npm-test: every test file under the four roots in the head tree is started', () => {
  const all = head.tree.filter((f) => ROOTS.includes(f.split('/')[0]) && isTest(f));
  assert.deepEqual(all.filter((f) => !headFiles.includes(f)), []);
});

test('no-verify-in-npm-test: every file under the four roots npm test started at the base it starts at the head', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE.slice(0, 7)} not readable here`);
  const baseScript = JSON.parse(show(BASE, 'package.json')).scripts.test;
  assert.match(baseScript, /verify\/\*\*/, 'the base script ran verify/');
  const baseFiles = started(baseScript, lsTree(BASE));
  const kept = baseFiles.filter((f) => ROOTS.includes(f.split('/')[0]));
  assert.ok(kept.length > 150, `${kept.length} files`);
  const headAtVerified = started(JSON.parse(show(VERIFIED, 'package.json')).scripts.test, lsTree(VERIFIED));
  assert.deepEqual(kept.filter((f) => !headAtVerified.includes(f)), [], 'base files the head no longer starts');
  const dropped = baseFiles.filter((f) => !headAtVerified.includes(f));
  assert.ok(dropped.every((f) => f.startsWith('verify/')), `dropped outside verify/: ${dropped.filter((f) => !f.startsWith('verify/'))}`);
  t.diagnostic(`base ${baseFiles.length} files (${dropped.length} under verify/), head ${headAtVerified.length}; added ${headAtVerified.filter((f) => !baseFiles.includes(f)).join(', ')}`);
});
