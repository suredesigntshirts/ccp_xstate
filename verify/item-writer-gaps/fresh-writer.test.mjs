// Expect fresh-writer, the part a test can redo: the fresh session's answer (evidence/fresh-writer.md, from claude -p
// in a clean clone of the head) is graded against the Expect line's three points, and what it cites is checked to be
// written in the repository at the checkout, so the answer came from the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, flat, read, section } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-writer.md'), 'utf8');
const answer = evidence.split('\n## Answer\n')[1].split('\n## Grading')[0];
const part = (lead) => {
  const i = answer.indexOf(`**${lead}`);
  assert.ok(i >= 0, `no part "${lead}"`);
  const j = answer.indexOf('\n**', i + 2);
  return answer.slice(i, j < 0 ? undefined : j);
};
const schema = JSON.parse(read('plan/item.schema.json'));

test('the answer names every readyRequired field and says the list is readyRequired in plan/item.schema.json', () => {
  const p = part('Fields a ready item must fill');
  assert.match(p, /`readyRequired`/);
  assert.match(p, /plan\/item\.schema\.json/);
  for (const f of schema.readyRequired) assert.match(p, new RegExp(`\`${f}\``), f);
  assert.match(p, /plan\/README\.md/);
  assert.match(flat(section(read('plan/README.md'), 'How an item is written')), /`readyRequired`/);
});

test('the answer says depends_on may not name an item in a later stage, citing the README and the check', () => {
  const p = part('May `depends_on`');
  assert.match(p, /\?\*\* No\./);
  assert.match(p, /plan\/README\.md/);
  assert.match(p, /plan\/check\.mjs/);
  const plan = flat(section(read('plan/README.md'), 'Changing the plan'));
  assert.match(plan, /`depends_on`/);
  assert.match(plan, /later stage/);
  assert.match(read('plan/check.mjs'), /which is in a later stage/);
});

test('the answer says reader_effort is not a field it writes, citing repository files', () => {
  const p = part('Do you write `reader_effort`');
  assert.match(p, /\?\*\* No\b/);
  assert.match(p, /docs\/language\.md/);
  assert.match(flat(read('docs/language.md')), /never stored/);
  assert.ok(!schema.readyRequired.includes('reader_effort'));
  assert.doesNotMatch(section(read('plan/README.md'), 'How an item is written'), /reader_effort/);
});
