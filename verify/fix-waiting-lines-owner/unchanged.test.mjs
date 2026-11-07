// Expect unchanged: every stage of every workflow renders to main's bytes and every workflow hash is main's
// (verify/fix-refusal-hints/prompts.mjs; evidence/main-prompts.json from main 3be0740); spawn() and a ccp-run
// PreToolUse through the hook answer as main does, including a ccp-run from a session that doesn't own the item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, REPO } from './lib.mjs';
import { spawns } from './scenarios.mjs';
import { prompts } from '../fix-refusal-hints/prompts.mjs';

// Main's rows as journal v2 reads them (upcast), the format the head writes. The evidence drops hashes as run-to-run
// noise, so a prompt row (in v1 a brief.stored whose role is its own actor) is told apart here by its role.
const { upcast } = await import(new URL('../../packages/journal/src/index.js', import.meta.url));
const v2 = (x) => {
  if (Array.isArray(x)) return x.map(v2);
  if (!x || typeof x !== 'object') return x;
  if (Number.isInteger(x.v) && typeof x.kind === 'string') {
    const u = upcast(x);
    return u.kind === 'brief.stored' && u.payload?.run && u.payload.role === u.payload.actor ? { ...u, kind: 'prompt.stored' } : u;
  }
  return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v2(v)]));
};

const main = v2(JSON.parse(readFileSync(join(HERE, 'evidence', 'main-scenarios.json'), 'utf8')).spawns);

test('unchanged: renders and hashes of every workflow are main\'s', async () => {
  const want = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-prompts.json'), 'utf8'));
  assert.ok(Object.keys(want.renders).length >= 10);
  assert.deepEqual(await prompts(REPO), want);
});

test('unchanged: spawn() direct and through the hook answer and write what main does', async () => {
  const got = await spawns(REPO);
  assert.deepEqual(got, main);
  assert.equal(got.engine["other's run"].allow, true);
  assert.ok(got.hook["other's ccp-run"].hookSpecificOutput.updatedInput.prompt.startsWith('## Rules'));
});
