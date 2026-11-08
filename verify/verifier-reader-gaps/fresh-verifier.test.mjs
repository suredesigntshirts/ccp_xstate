// Expect fresh-verifier, the part a test can redo: the fresh session's answer (evidence/fresh-verifier.md, from
// claude -p in a clean clone of the head) is graded against the Expect line's four points, and what it cites is
// checked to be written in docs/gates.md at the checkout, so the answer came from the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, read } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-verifier.md'), 'utf8');
const answer = evidence.split('\n## Answer\n')[1].split('\n## Grading')[0];
const para = (lead) => answer.split('\n\n').map((p) => p.trim()).find((p) => p.startsWith(`**${lead}`)) ?? '';
const gates = read('docs/gates.md').replace(/\s+/g, ' ');

test('the answer gives the local verdict-gate command with PR_BODY carrying the Item line, from docs/gates.md', () => {
  const p = para('Run the gate locally.');
  assert.match(p, /`BASE_SHA=origin\/main PR_BODY='Item: <id>' node scripts\/gates\/pr-gate\.mjs verdict`/);
  assert.match(p, /docs\/gates\.md/);
  assert.ok(gates.includes("BASE_SHA=origin/main PR_BODY='Item: <id>' node scripts/gates/pr-gate.mjs verdict"));
});

test('the answer says a world result needs no test, from docs/gates.md', () => {
  const p = para('Does a `world` result need a test?');
  assert.match(p, /^\*\*Does a `world` result need a test\?\*\* No\./);
  assert.match(p, /docs\/gates\.md:\d+/);
  assert.match(gates, /a `world` result needs no `test`/);
});

test('the answer says a line about the PR\'s checks cites them at verified_sha, from docs/gates.md', () => {
  const p = para('Which sha for the PR');
  assert.match(p, /^\*\*Which sha for the PR's ci checks\?\*\* `verified_sha`/);
  assert.match(p, /docs\/gates\.md/);
  assert.match(gates, /cites them at `verified_sha`, since they run again on the verdict commit/);
});

test('the answer says model is the session\'s own model id, from docs/gates.md', () => {
  const p = para('What goes in `model`?');
  assert.match(p, /its own model id/);
  assert.match(p, /docs\/gates\.md:\d+/);
  assert.match(gates, /"model": "<its own model id>"/);
});
