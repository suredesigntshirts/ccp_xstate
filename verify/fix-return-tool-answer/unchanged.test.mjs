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

// prompt-catalogue: a refusal row also carries payload.message, the catalogue entry and slots its reason was rendered
// from. The row is main's once that is checked to render the reason and set aside (plan item prompt-catalogue lets a
// done verifier test compare the rendered entry instead of the literal).
const { render } = await import(new URL('../../packages/engine/src/messages.js', import.meta.url));
const asMain = (rows) => rows.map((r) => {
  if (r?.payload?.message === undefined) return r;
  const { message, ...payload } = r.payload;
  assert.equal(render(message.entry, message.slots), payload.reason, `${payload.rule} row: its entry renders its reason`);
  return { ...r, payload };
});

// Main's rows read as journal v2 reads them (upcast), the format the head writes.
const { upcast } = await import(new URL('../../packages/journal/src/index.js', import.meta.url));

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
  assert.deepEqual(asMain(head.rows), main.rows.map((r) => upcast(r)));
  assert.deepEqual(head.results, main.results);
  assert.equal(head.server.beforeAccept, main.server.beforeAccept);
  assert.match(head.server.beforeAccept, /^not accepted: /);
  assert.match(head.server.accepted, /^accepted: /);
  assert.match(head.server.verifyAccepted, /^accepted: /);
  assert.match(main.server.accepted, /^not accepted: /);
});
