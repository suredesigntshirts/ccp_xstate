// scope: the build changes only the item's output files and its own item file; no verdict.json or evidence file
// under verify/ changes. Read over the build's readying replan, over the main merged into the head, and over main
// before the replan (where the replan's plan/ files show).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, BUILD, FILES, HEAD, MAIN, READY, git, origin } from './lib.mjs';

const ALLOWED = new Set([...FILES, 'docs/traps.md', 'plan/items/pinned-fetch-temp-repo.md']);
const names = (a, b) => git(origin(), 'diff', '--name-only', a, b).split('\n').filter(Boolean);
const verdictOrEvidence = (p) => /^verify\/[^/]+\/(verdict\.json|evidence\/)/.test(p);

test('the build over its readying replan changes only the outputs and its item file', () => {
  assert.ok(origin(), 'the pinned commits are readable');
  const files = names(READY, BUILD);
  assert.deepEqual(files.filter((p) => !ALLOWED.has(p)), []);
  assert.ok(files.includes('docs/traps.md') && FILES.every((f) => files.includes(f)), 'every output changes');
  assert.deepEqual(files.filter(verdictOrEvidence), []);
});

test('the head over the main merged into it changes only the outputs and its item file', () => {
  const files = names(MAIN, HEAD);
  assert.deepEqual(files.filter((p) => !ALLOWED.has(p)), []);
  assert.deepEqual(files.filter(verdictOrEvidence), []);
});

test('against main before the replan the rest is plan/ only and no verdict or evidence moves', () => {
  const files = names(BASE, BUILD);
  assert.deepEqual(files.filter((p) => !ALLOWED.has(p) && !p.startsWith('plan/')), []);
  assert.deepEqual(files.filter(verdictOrEvidence), []);
});
