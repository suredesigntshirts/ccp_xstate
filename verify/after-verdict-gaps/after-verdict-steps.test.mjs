// Expect after-verdict-steps: plan/README.md's How an item moves carries what a builder does after the verdict, read
// by the words that carry each rule (docs/layout.md, Tests); docs/gates.md's verdict row no longer says "at the head sha".
import test from 'node:test';
import assert from 'node:assert/strict';
import { flat, read, section, step } from './lib.mjs';

const moves = section(read('plan/README.md'), 'How an item moves');
const verdictStep = step(moves, 3);
const mergeStep = step(moves, 4);

test('step 3: on a NOT MET line the builder pushes a fix and asks for a verifier again', (t) => {
  t.diagnostic(verdictStep);
  assert.match(verdictStep, /NOT MET/);
  assert.match(verdictStep, /builder/);
  assert.match(verdictStep, /\bfix\b/);
  assert.match(verdictStep, /\bverifier again\b/);
  assert.match(verdictStep, /\bstarter\b/);
});

test('step 3: the next verdict replaces the last', () => {
  assert.match(verdictStep, /next verdict/);
  assert.match(verdictStep, /\breplaces\b/);
});

test('step 4: the merge is a merge commit; merging main in keeps the verdict and a rebase does not', (t) => {
  t.diagnostic(mergeStep);
  assert.match(mergeStep, /merge commit/);
  assert.match(mergeStep, /merging main in/);
  assert.match(mergeStep, /\bkeeps\b/);
  assert.match(mergeStep, /\brebase does not\b/);
});

test('step 4: the merging thread tells its starter what the release command printed', () => {
  assert.match(mergeStep, /release command/);
  assert.match(mergeStep, /\btell\b/);
  assert.match(mergeStep, /\bstarter\b/);
  assert.match(mergeStep, /\bprinted\b/);
});

test("docs/gates.md's verdict row no longer says at the head sha", (t) => {
  const row = read('docs/gates.md').split('\n').find((l) => l.startsWith('| `verdict` | verdict |'));
  t.diagnostic(row);
  assert.ok(row, 'no verdict row');
  assert.doesNotMatch(flat(row), /at the head sha/);
  assert.match(row, /complete verdict/);
});
