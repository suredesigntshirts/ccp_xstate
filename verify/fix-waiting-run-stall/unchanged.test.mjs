// Expect unchanged (prompt half): every stage of every workflow renders to main's bytes and every workflow's hash is
// main's. evidence/main-prompts.json is verify/fix-refusal-hints/prompts.mjs run on a checkout of main (3f8815c).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { prompts } from '../fix-refusal-hints/prompts.mjs';

test('unchanged: renders and hashes of every workflow are main\'s', async () => {
  const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-prompts.json'), 'utf8'));
  assert.ok(Object.keys(main.renders).length >= 10);
  assert.deepEqual(await prompts(REPO), main);
});
