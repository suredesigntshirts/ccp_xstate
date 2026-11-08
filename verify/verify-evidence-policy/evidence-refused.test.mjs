// Expect evidence-refused: the evidence gate, run as a PR would run it, refuses a large or .pass file a PR adds or
// grows under verify/, and passes a 64 KB evidence file, a large file outside verify/, and deletions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KB64, gateRepo } from './lib.mjs';

const BASE = { 'verify/x/notes.md': 'small notes\n', 'verify/old/big.json': 'b'.repeat(200 * 1024),
  'verify/old/suite.pass': 'ok 1 - a\n' };

const CASES = [
  { name: 'adds a 70 KB file under verify/x/', files: { 'verify/x/capture.json': 'c'.repeat(70 * 1024) },
    status: 1, says: [/verify\/x\/capture\.json/, new RegExp(String(70 * 1024))] },
  { name: 'adds a one-line verify/x/listing.pass', files: { 'verify/x/listing.pass': 'ok 1 - a\n' },
    status: 1, says: [/verify\/x\/listing\.pass/] },
  { name: 'grows verify/x/notes.md past 64 KB', files: { 'verify/x/notes.md': 'n'.repeat(KB64 + 1) },
    status: 1, says: [/verify\/x\/notes\.md/, new RegExp(String(KB64 + 1))] },
  { name: 'adds a file of exactly 64 KB under verify/x/evidence/', files: { 'verify/x/evidence/a.md': 'e'.repeat(KB64) },
    status: 0 },
  { name: 'adds a 200 KB file under docs/', files: { 'docs/huge.md': 'd'.repeat(200 * 1024) }, status: 0 },
  { name: 'deletes a large and a .pass file committed at the base',
    files: { 'verify/old/big.json': null, 'verify/old/suite.pass': null }, status: 0 },
];

for (const c of CASES) {
  test(`evidence gate on a PR that ${c.name} exits ${c.status}`, (t) => {
    const r = gateRepo(t, BASE);
    r.branch('build/vep-case');
    r.commit(c.files, c.name);
    const out = r.evidence();
    assert.equal(out.status, c.status, out.out);
    for (const re of c.says ?? []) assert.match(out.out, re);
    t.diagnostic(`exit ${out.status}: ${out.out.trim().replace(/\s+/g, ' ').slice(0, 300)}`);
  });
}

test('a PR that renames a small file under verify/ into a .pass name is refused', (t) => {
  const r = gateRepo(t, BASE);
  r.branch('build/vep-case');
  r.git('mv', 'verify/x/notes.md', 'verify/x/notes.pass');
  r.git('commit', '-q', '-m', 'rename');
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/notes\.pass/);
});

test('both refusals in one PR are each named', (t) => {
  const r = gateRepo(t, BASE);
  r.branch('build/vep-case');
  r.commit({ 'verify/x/listing.pass': 'ok\n', 'verify/x/big.txt': 'z'.repeat(70 * 1024) });
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/listing\.pass/);
  assert.match(out.out, /verify\/x\/big\.txt/);
});
