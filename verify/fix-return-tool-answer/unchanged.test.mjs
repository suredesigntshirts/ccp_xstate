// Expect unchanged: no prompt or check changes. Every stage of every workflow renders to main's bytes and every
// workflow hash is main's (evidence/main-prompts.json: verify/fix-refusal-hints/prompts.mjs run on a checkout of main
// 762e2c1). The same returns through the real hook give main's hook answers, refusal and result.stored rows and
// stored results; only the server's answer to the accepted results differs (evidence/main-scenarios.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { prompts } from '../fix-refusal-hints/prompts.mjs';
import { scenarios } from './scenarios.mjs';

const ev = (f) => JSON.parse(readFileSync(join(HERE, 'evidence', f), 'utf8'));

test('unchanged: renders and hashes of every workflow are main\'s', async () => {
  const main = ev('main-prompts.json');
  assert.equal(Object.keys(main.renders).length, 10);
  assert.deepEqual(await prompts(REPO), main);
});

test('unchanged: hook answers, refusal and result.stored rows and stored results are main\'s; only the server answer moved', async () => {
  const main = ev('main-scenarios.json');
  const head = await scenarios(REPO);
  assert.deepEqual(head.hook, main.hook);
  assert.deepEqual(head.rows.map((r) => `${r.kind}:${r.payload.rule ?? ''}`),
    ['result.stored:', 'refusal:wrong-caller', 'refusal:schema', 'refusal:reserved', 'refusal:ref', 'result.stored:', 'refusal:already-returned', 'result.stored:']);
  assert.deepEqual(head.rows, main.rows);
  assert.deepEqual(head.results, main.results);
  assert.equal(head.server.beforeAccept, main.server.beforeAccept);
  assert.match(head.server.beforeAccept, /^not accepted: /);
  assert.match(head.server.accepted, /^accepted: /);
  assert.match(head.server.verifyAccepted, /^accepted: /);
  assert.match(main.server.accepted, /^not accepted: /);
});
