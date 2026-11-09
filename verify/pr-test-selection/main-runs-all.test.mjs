// main-runs-all: ci on a push to main runs npm test, whose globs cover every guard file, and not the PR selection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, selector } from './lib.mjs';

const ci = readFileSync(join(REPO, '.github', 'workflows', 'ci.yml'), 'utf8');
const steps = ci.split(/\n(?=\s+- (?:name|uses):)/).map((s) => s.trim());

test('main-runs-all: ci runs on pushes to main and on pull requests', () => {
  assert.match(ci, /\non:\n\s+pull_request:\n\s+push:\n\s+branches: \[main\]/);
});

test('main-runs-all: the step running npm test runs on every event but pull_request, and the selection only on pull_request', () => {
  const full = steps.filter((s) => /\n\s*run: npm test\s*$/.test(s));
  assert.equal(full.length, 1, 'one npm test step');
  assert.match(full[0], /if: github\.event_name != 'pull_request'/);
  const pr = steps.filter((s) => /pr-tests\.mjs/.test(s) && /run:/.test(s));
  assert.equal(pr.length, 1, 'one selection step');
  assert.match(pr[0], /if: github\.event_name == 'pull_request'/);
  for (const s of steps.filter((x) => /run: node --test|run: npx|select-tests/.test(x))) assert.fail(`another test step: ${s}`);
});

test('main-runs-all: npm test\'s globs cover every guard file the selector knows', () => {
  const script = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts.test;
  const first = script.split(' && ')[0];
  for (const g of ['"test/**/*.test.mjs"', '"scripts/**/*.test.mjs"', '"packages/**/*.test.{js,mjs}"', '"plugins/**/*.test.{js,mjs}"']) {
    assert.ok(first.includes(g), g);
  }
  assert.doesNotMatch(first, /--test-name-pattern|--test-only/);
  const globs = [/^test\/.*\.test\.mjs$/, /^scripts\/.*\.test\.mjs$/, /^packages\/.*\.test\.(js|mjs)$/, /^plugins\/.*\.test\.(js|mjs)$/];
  const guards = selector.reaches(REPO).guards;
  assert.ok(guards.length > 100);
  for (const g of guards) assert.ok(globs.some((re) => re.test(g)), g);
});
