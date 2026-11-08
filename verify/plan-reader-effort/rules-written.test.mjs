// Expect rules-written: docs/gates.md's freeze section names reader_effort among the fields a frozen item may
// change; docs/language.md defines reader effort.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const section = (text, heading) => text.split(new RegExp(`^## ${heading}\\s*$`, 'm'))[1]?.split(/^## /m)[0] ?? '';

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
