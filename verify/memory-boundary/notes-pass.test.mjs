// notes-pass: the verdict gate passes a PR that names no item and changes only the notes files, or those beside plan/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictOver } from './lib.mjs';

const cases = {
  'docs/traps.md changed': { 'docs/traps.md': '# Container traps\n\n## A new trap\n\nHow it shows.\n' },
  'docs/verifying.md added': { 'docs/verifying.md': '# Verifying an item\n\n## A technique\n' },
  'docs/traps.md and plan/': { 'docs/traps.md': '# Container traps\n\nmore\n', 'plan/decisions/d.md': '# d\n' },
  'docs/verifying.md and plan/': { 'docs/verifying.md': '# Verifying\n', 'plan/items/y.md': '# y\n', 'plan/ledger/l.md': 'l\n' },
  'both notes files and plan/': { 'docs/traps.md': 'a\n', 'docs/verifying.md': 'b\n', 'plan/decisions/d.md': 'd\n' },
  'docs/traps.md deleted': { 'docs/traps.md': null },
};

for (const [name, files] of Object.entries(cases)) {
  test(`verdict gate passes a PR with no Item line: ${name}`, (t) => {
    const r = verdictOver(t, files);
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /verdict gate passed/);
  });
}

test('verdict gate passes a notes PR whose body is empty', (t) => {
  const r = verdictOver(t, { 'docs/traps.md': 'a\n' }, '');
  assert.equal(r.status, 0, r.out);
});
