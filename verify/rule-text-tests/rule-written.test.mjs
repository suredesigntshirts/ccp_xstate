// Expect rule-written: docs/layout.md's Tests section says a test reading a rule text checks the words that carry the
// rule and not a whole sentence. Following that rule, each point is matched by its own carrying words, within one
// paragraph of the section, so a rewording that keeps the rule keeps this green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, section } from './lib.mjs';

const tests = section(read('docs/layout.md'), 'Tests');
const para = tests.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, ' ')).find((p) => /rule text/i.test(p));

test('the Tests section has a paragraph about tests that read a rule text', (t) => {
  assert.ok(para, tests);
  t.diagnostic(para);
});

test('it names where rule texts live', () => {
  for (const where of [/CLAUDE\.md/, /plan/, /docs/]) assert.match(para, where);
});

test('it says to match the words that carry the rule', () => {
  assert.match(para, /\bwords?\b/i);
  assert.match(para, /\bcarr(y|ies)\b/i);
});

test('it says never a phrase', () => {
  assert.match(para, /\b(never|not|no)\b/i);
  assert.match(para, /\bphrases?\b/i);
});

test('it says never a whole sentence', () => {
  assert.match(para, /\bsentences?\b/i);
});

test('it says why: a rewording that keeps the rule keeps the test green', () => {
  assert.match(para, /reword/i);
  assert.match(para, /green|pass/i);
});
