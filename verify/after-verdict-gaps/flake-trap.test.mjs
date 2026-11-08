// Expect flake-trap: docs/traps.md says a ci test the PR did not touch that goes red gets one re-run, and that red
// again it is a real failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { flat, read } from './lib.mjs';

const traps = read('docs/traps.md');

test('docs/traps.md: an untouched red ci test gets one re-run, then is a real failure', (t) => {
  const heading = traps.split('\n').find((l) => /^## /.test(l) && /did not touch/.test(l));
  assert.ok(heading, 'no section for a red test the PR did not touch');
  const body = flat(traps.slice(traps.indexOf(heading) + heading.length).split(/\n## /)[0]);
  t.diagnostic(`${heading} ${body}`);
  assert.match(body, /`ci`/);
  assert.match(body, /\bonce\b/);
  assert.match(body, /\bre-run\b|\bRe-run\b/i);
  assert.match(body, /red again/);
  assert.match(body, /real failure/);
});
