// Expect fresh-merger, the part a test can redo: the fresh session's answer (evidence/fresh-merger.md, from claude -p
// in a clean clone of the head with an empty HOME) is graded against the Expect line's points, and what it cites is
// checked to be written in the repository at the checkout, so the answer came from the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, flat, read, section, step, term } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-merger.md'), 'utf8');
const answer = evidence.split('\n## Answer\n')[1].split('\n## Grading')[0];
const part = (lead) => {
  const i = answer.indexOf(`**${lead}`);
  assert.ok(i >= 0, `no part "${lead}"`);
  const j = answer.indexOf('\n**', i + 2);
  return flat(answer.slice(i, j < 0 ? undefined : j));
};
const moves = section(read('plan/README.md'), 'How an item moves');

test('NOT MET: a fix, a verifier again, and the next verdict replacing the last, citing plan/README.md', () => {
  const p = part('If a line is NOT MET');
  assert.match(p, /push a fix/);
  assert.match(p, /verifier again/);
  assert.match(p, /replaces the last/);
  assert.match(p, /plan\/README\.md/);
  assert.match(step(moves, 3), /next verdict replaces the last/);
});

test('the merge is a merge commit, citing plan/README.md', () => {
  const p = part('If all lines are MET');
  assert.match(p, /merge commit/);
  assert.match(p, /plan\/README\.md/);
  assert.match(step(moves, 4), /merge commit/);
});

test('merging main in keeps the verdict, citing plan/README.md and docs/gates.md', () => {
  const p = part('Merging main in first');
  assert.match(p, /Yes, you may/);
  assert.match(p, /keeps it, a rebase does not/);
  assert.match(p, /docs\/gates\.md/);
  assert.ok(step(moves, 4).includes('merging main in after the verdict keeps it, a rebase does not'));
  assert.match(flat(section(read('docs/gates.md'), 'The verdict')), /no later commit other than a merge changes anything outside `verify\/`/);
});

test('the starter is the session that started the thread, quoting docs/language.md', () => {
  const p = part('Who your starter is');
  assert.match(p, /docs\/language\.md/);
  const row = term(read('docs/language.md'), 'starter');
  assert.ok(p.includes(row[1].replace(/^./, (c) => c.toUpperCase()).replace(/\.$/, '')), row[1]);
});
