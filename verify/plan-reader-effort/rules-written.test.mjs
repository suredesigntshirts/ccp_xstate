// Expect rules-written: plan/README.md's head-field table and done step name reader_effort and the command;
// docs/gates.md's freeze section names reader_effort among the fields a frozen item may change; docs/language.md
// defines reader effort.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const section = (text, heading) => text.split(new RegExp(`^## ${heading}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';
const COMMAND = /node scripts\/reader-effort\.mjs\s+<pr> --json/;

test('plan/README.md: the head-field table has a reader_effort row, and the done step names the field and the command', (t) => {
  const text = read('plan/README.md');
  const row = text.split('\n').find((l) => /^\| `reader_effort` \|/.test(l));
  assert.ok(row, 'a head-field table row for reader_effort');
  const step = text.match(/^5\. \*\*Done replan\.\*\*[\s\S]*?(?=\n\n|\n\d\. )/m)?.[0] ?? '';
  t.diagnostic(`row: ${row}`);
  t.diagnostic(`done step: ${step.replace(/\s+/g, ' ')}`);
  assert.match(step, /`reader_effort`/);
  assert.match(step.replace(/\s+/g, ' '), COMMAND);
});

test('docs/gates.md: the freeze section names reader_effort with status and done_on as outside the frozen head', (t) => {
  const freeze = section(read('docs/gates.md'), 'The contract freeze').replace(/\s+/g, ' ');
  t.diagnostic(freeze.match(/head \([^)]*\)/)?.[0] ?? freeze.slice(0, 200));
  assert.match(freeze, /head \(all but `status`, `done_on` and `reader_effort`\)/);
});

test('docs/language.md: a glossary row defines reader effort', (t) => {
  const row = read('docs/language.md').split('\n').find((l) => /^\| reader effort \|/.test(l));
  t.diagnostic(row ?? 'none');
  assert.ok(row, 'a row for reader effort');
  assert.match(row, /lines a reader opens/);
  assert.match(row, /`reader_effort`/);
});
