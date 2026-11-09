// reader-answers: the recorded fresh-reader runs (evidence/reader-answers.md) cover every question in the guard's data,
// and each answer named its home and every carrying term. The runs need claude, so the test reads their record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const { questions } = JSON.parse(read('test/notes-questions.json'));
const rows = read('verify/memory-learnings-written/evidence/reader-answers.md').split('\n')
  .filter((l) => /^\| \d+ \|/.test(l)).map((l) => l.split('|').map((c) => c.trim()).slice(1, -1));

test('one recorded run per question, with its home', () => {
  assert.equal(rows.length, questions.length);
  rows.forEach(([n, home], i) => { assert.equal(Number(n), i + 1); assert.equal(home, questions[i].home); });
});

for (const [n, home, named, missing] of rows) {
  test(`answer ${n} named ${home} and every carrying term`, () => {
    assert.equal(named, 'yes', `answer ${n} did not name ${home}`);
    assert.equal(missing, 'none', `answer ${n} lacked ${missing}`);
  });
}
