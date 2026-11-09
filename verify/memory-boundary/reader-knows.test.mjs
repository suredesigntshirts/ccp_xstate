// reader-knows: regrades the memory-off fresh reader's answer kept in evidence/reader-knows.md. Each numbered answer
// names the repo's home for the thing and does not send it to project memory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE } from './lib.mjs';

const text = readFileSync(join(HERE, 'evidence', 'reader-knows.md'), 'utf8');
const answer = text.split('\n## Answer\n')[1].split('\n## Grading\n')[0];
const parts = answer.split(/^(?=\d\. )/m).filter((p) => /^\d\. /.test(p));
const sentences = (p) => p.split(/(?<=[.!?])\s+/);
const sendsToMemory = (p) => sentences(p).some((s) => /project memory|\b(in|to) memory\b/i.test(s) && !/\b(don't|do not|not|never|only|no)\b/i.test(s));

test('the reader answered all four, from the repo', () => {
  assert.equal(parts.length, 4, answer);
  assert.match(answer, /CLAUDE\.md/);
});

const homes = [
  ['a container trap goes in docs/traps.md', /`docs\/traps\.md`/],
  ['a verifier technique goes in docs/verifying.md', /`docs\/verifying\.md`/],
  ['a defect goes in a plan item', /plan item|plan\/items\//],
  ['a merged PR number is recorded nowhere', /\bnowhere\b/i],
];

homes.forEach(([name, home], i) => {
  test(name, () => {
    const part = parts[i];
    assert.match(part.split('\n')[0], home, part);
    assert.ok(!sendsToMemory(part), `sends to memory: ${part}`);
  });
});
