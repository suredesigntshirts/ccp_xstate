// Expect terms-defined: docs/language.md has a line for round (one build push and the verdict on it) and a line for
// starter (the session that started a thread).
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, term } from './lib.mjs';

const lang = read('docs/language.md');

test('round: one build push and the verdict on it', (t) => {
  const row = term(lang, 'round');
  t.diagnostic(JSON.stringify(row));
  assert.ok(row, 'no round line');
  assert.match(row[1], /\bbuild push\b/);
  assert.match(row[1], /\bverdict\b/);
});

test('starter: the session that started a thread', (t) => {
  const row = term(lang, 'starter');
  t.diagnostic(JSON.stringify(row));
  assert.ok(row, 'no starter line');
  assert.match(row[1], /\bsession\b/);
  assert.match(row[1], /\bstarted\b/);
  assert.match(row[1], /\bthread\b/);
});

test('each term has exactly one line', () => {
  for (const name of ['round', 'starter']) {
    assert.equal(lang.split('\n').filter((l) => l.startsWith(`| ${name} |`)).length, 1, name);
  }
});
