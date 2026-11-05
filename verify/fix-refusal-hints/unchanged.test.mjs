// Expect unchanged (prompt half): every stage of every workflow renders to main's bytes, and every workflow's hash is
// main's. evidence/main-prompts.json is prompts.mjs run on a checkout of main (bbcdadc); CI's checkout is depth 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { prompts } from './prompts.mjs';

test('unchanged: renders and hashes of every workflow are main\'s', async () => {
  const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-prompts.json'), 'utf8'));
  const head = await prompts(REPO);
  assert.equal(Object.keys(main.renders).length, 10, 'all 10 stages of the 4 workflows');
  assert.deepEqual(head, main);
});
