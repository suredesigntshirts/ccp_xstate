// Expect policy-written: plan/README.md, docs/gates.md and docs/language.md state the evidence policy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const section = (text, heading, level = '##') => {
  const start = text.indexOf(heading);
  assert.ok(start >= 0, `has ${heading}`);
  const rest = text.slice(start + heading.length);
  const end = rest.search(new RegExp(`\\n${level} `));
  return (end < 0 ? rest : rest.slice(0, end)).replace(/\s+/g, ' ');
};

// What both texts must say, each as a pattern over the text with whitespace folded.
const POLICY = [
  [/one evidence file/i, 'one evidence file per Expect line'],
  [/per Expect line|For each Expect line/i, 'per Expect line'],
  [/command/, 'the command'], [/excerpt/, 'the excerpt'], [/inputs (needed )?to run it again/, 'the inputs to run it again'],
  [/listing/, 'no listing'], [/journal root/, 'no journal root'], [/capture of main/, 'no capture of main'],
  [/64 KB/, 'the 64 KB limit'], [/\.pass/, 'the .pass rule'], [/evidence gate/i, 'the evidence gate'],
  [/refuses/, 'the gate refuses'], [/verify\//, 'files under verify/'],
];

test('plan/README.md "How slop is kept out" states the evidence policy', () => {
  const s = section(read('plan/README.md'), 'How slop is kept out');
  for (const [re, what] of POLICY) assert.match(s, re, what);
  assert.match(s, /verify\/<item>\/evidence\//);
});

test('docs/gates.md states the evidence policy and lists the evidence step in its gate table', () => {
  const text = read('docs/gates.md');
  const s = section(text, '## Evidence');
  for (const [re, what] of POLICY) assert.match(s, re, what);
  const row = text.split('\n').find((l) => /^\| `verdict` \| evidence \|/.test(l));
  assert.ok(row, 'gate table row for the evidence step');
  assert.match(row, /64 KB/);
  assert.match(row, /\.pass/);
  assert.match(row, /verify\//);
});

test('docs/language.md defines evidence file in the Plan context', () => {
  const text = read('docs/language.md');
  const plan = section(text, '## Plan');
  assert.match(plan, /\| evidence file \| [^|]*command[^|]*excerpt[^|]*inputs to run it again/);
});
