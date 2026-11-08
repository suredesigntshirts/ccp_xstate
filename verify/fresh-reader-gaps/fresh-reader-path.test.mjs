// Expect fresh-reader-path, the part a test can redo: the fresh session's answer (evidence/fresh-reader-path.md, from
// claude -p in a clean clone of the head) is graded against the Expect line's four points, and each point it cites
// is checked to be written in the cited file at the checkout, so the answer came from the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { HERE, read, section } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-reader-path.md'), 'utf8');
const answer = evidence.split('## Answer')[1].split('\n## Grading')[0];
const part = (heading) => answer.split(`## ${heading}`)[1]?.split('\n## ')[0] ?? '';
const readme = read('plan/README.md');
const step = (n) => readme.match(new RegExp(`^${n}\\. \\*\\*[\\s\\S]*?(?=\\n\\d\\. \\*\\*|\\n\\n)`, 'm'))[0];

test('done_on takes the day of the build PR\'s first commit, as plan/README.md step 2 says', () => {
  assert.match(part('Which date goes in `done_on`'), /day of the build PR's first commit/);
  assert.match(part('Which date goes in `done_on`'), /plan\/README\.md`, step 2/);
  assert.match(step(2), /first commit sets[^.]*`done`[^.]*`done_on` to that day/);
});

test('the builder writes nothing under verify/<id>/ and asks for a verifier, as step 2 says', () => {
  assert.match(part('What you write under `verify/`'), /^Nothing\./m);
  assert.match(part('What you write under `verify/`'), /The builder writes nothing under `verify\/<id>\/`/);
  assert.match(answer, /Ask whoever started you to start a separate verifier session/);
  assert.match(part('Who writes the verdict'), /A separate session/);
  assert.match(step(2), /writes nothing under `verify\/<id>\/`[^.]*verifier/);
});

test('one verifier suite runs with its test files named, as CLAUDE.md Commands says', () => {
  const run = part('Running one verifier suite locally');
  assert.match(run, /node --test "verify\/<item>\/\*\.test\.mjs"/);
  assert.match(run, /bare folder fails \(`CLAUDE\.md`, Commands\)/);
  assert.match(section(read('CLAUDE.md'), 'Commands'), /node --test "verify\/<item>\/\*\.test\.mjs"\s+# one suite: name its files, a bare folder fails/);
});

test('the merging thread runs the release command, as docs/gates.md After the merge says', () => {
  const after = part('After the merge');
  assert.match(after, /git fetch origin main && node scripts\/release\/release\.mjs branch --push/);
  assert.match(after, /The thread that merged runs the release/);
  assert.match(section(read('docs/gates.md'), 'After the merge'),
    /The thread that merged runs `git fetch origin main && node scripts\/release\/release\.mjs branch --push`/);
});
