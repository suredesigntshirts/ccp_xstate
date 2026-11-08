// Expect listing-refused: real node:test output of ten or more tests saved as verify/x/evidence/listing.txt is refused
// as a test listing, TAP and spec; an evidence .md with a command, four result lines and the summary passes; a file
// over 64 KB and a *.pass file are still refused; a branch deleting a listing committed at the base passes.
// Every listing here is made at run time, so this file holds no result lines for the gate to read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { KB, gateRepo, listing } from './lib.mjs';

const PATH = 'verify/x/evidence/listing.txt';

for (const [form, reporter] of [['TAP (piped)', undefined], ['spec reporter', 'spec']]) {
  test(`a ten-test node:test listing in ${form} saved as listing.txt is refused as a test listing`, (t) => {
    const text = listing(t, 10, reporter);
    assert.ok(text.length < 64 * KB, `${text.length} bytes, under the size limit`);
    const r = gateRepo(t);
    r.branch('pr');
    r.commit({ [PATH]: text });
    const out = r.evidence();
    assert.equal(out.status, 1, out.out);
    assert.match(out.out, /verify\/x\/evidence\/listing\.txt is a test listing/);
    t.diagnostic(`${text.length} bytes: ${out.out.trim().split('\n').find((l) => l.includes('listing.txt'))}`);
  });
}

// An excerpt as the brief asks for: the command, four result lines cut from a real TAP run, and its summary.
function excerpt(t) {
  const lines = listing(t, 10).split('\n');
  const results = lines.filter((l) => /^ok \d+ /.test(l)).slice(0, 4);
  const summary = lines.filter((l) => /^# (tests|pass|fail) \d+/.test(l));
  assert.equal(results.length, 4);
  assert.equal(summary.length, 3);
  return ['# Evidence', '', 'Command: `node --test ten.test.mjs`', '', '```', ...results, '...', ...summary, '```', ''].join('\n');
}

test('an evidence .md with a command, four result lines and the pass and fail summary passes', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/evidence/listing-refused.md': excerpt(t) });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});

test('a file over 64 KB and a *.pass file under verify/ are still refused', (t) => {
  const r = gateRepo(t);
  r.branch('pr');
  r.commit({ 'verify/x/capture.json': 'y'.repeat(64 * KB + 1), 'verify/x/notes.pass': 'one line\n' });
  const out = r.evidence();
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /verify\/x\/capture\.json is 65537 bytes, over the 65536-byte limit/);
  assert.match(out.out, /verify\/x\/notes\.pass is a test listing/);
});

test('a branch deleting a listing committed at the base is never read and passes', (t) => {
  const r = gateRepo(t, { [PATH]: listing(t, 12) });
  r.branch('pr');
  r.commit({ [PATH]: null });
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  t.diagnostic(out.out.trim());
});
