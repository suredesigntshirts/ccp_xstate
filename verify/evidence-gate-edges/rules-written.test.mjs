// Expect rules-written: docs/gates.md says the evidence gate refuses a non-regular entry and a test listing by its
// text and leaves the rest to the verifier's brief; plan/README.md's evidence sentence says the same in short;
// docs/language.md defines test listing; CLAUDE.md, plan/README.md and docs/gates.md total under 230 lines.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const flat = (s) => s.replace(/\s+/g, ' ');
const section = (text, head) => text.split(/^## /m).find((s) => s.startsWith(head)) ?? '';

test('docs/gates.md: the evidence row and section name a non-regular entry, a test listing, and the brief for the rest', () => {
  const gates = read('docs/gates.md');
  const row = gates.split('\n').find((l) => l.startsWith('| `verdict` | evidence |'));
  assert.ok(row, 'the evidence row');
  assert.match(row, /not a regular file \(a symlink, a submodule\)/);
  assert.match(row, /test listing: a node:test pass and fail summary with ten or more result lines/);
  const ev = flat(section(gates, 'Evidence'));
  assert.match(ev, /not a regular file \(a symlink, a submodule\)/);
  assert.match(ev, /reads as a test listing \(`isListing`/);
  assert.match(ev, /the gate tells what it can by shape, the brief the rest/);
});

test('plan/README.md: the evidence sentence says the gate refuses a link or a listing and the brief the rest', () => {
  const s = flat(read('plan/README.md'));
  assert.match(s, /the gate refuses a link or a test listing, and the brief keeps out other captures/);
});

test('docs/language.md defines test listing', () => {
  const row = read('docs/language.md').split('\n').find((l) => l.startsWith('| test listing |'));
  assert.ok(row, 'a test listing row');
  assert.match(row, /pass and a fail summary line with ten or more result lines/);
  assert.match(row, /isListing/);
});

test('CLAUDE.md, plan/README.md and docs/gates.md total under 230 lines', (t) => {
  const n = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'].map((p) => read(p).split('\n').length - 1);
  const total = n.reduce((a, b) => a + b, 0);
  assert.ok(total < 230, `${total} lines`);
  t.diagnostic(`${n.join(' + ')} = ${total}`);
});
