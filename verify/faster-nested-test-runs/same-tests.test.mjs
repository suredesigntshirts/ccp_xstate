// Expect: faster-nested-test-runs/same-tests
// Every changed test file runs the same test names at the head as at the base, none skipped at the head that ran at
// the base, and all pass. The runs are record.mjs's (each file alone, TAP reporter, base and head clones); this reads
// the summary in evidence/same-tests.md and checks it covers every changed file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FILES, BASE, VERIFIED, evidence } from './lib.mjs';

const e = evidence('same-tests');

test('the summary is of the base and head this suite pins, and of every changed test file', () => {
  assert.equal(e.base, BASE);
  assert.equal(e.head, VERIFIED);
  assert.deepEqual(Object.keys(e.files).sort(), [...FILES].sort());
});

for (const file of FILES) {
  test(`${file}: same names, none newly skipped, all pass`, () => {
    const f = e.files[file];
    assert.ok(f.base.names > 0, 'tests ran at the base');
    assert.deepEqual({ onlyBase: f.onlyBase, onlyHead: f.onlyHead }, { onlyBase: [], onlyHead: [] });
    assert.equal(f.head.digest, f.base.digest, 'the sorted name lists are equal');
    assert.deepEqual(f.skippedNow, [], 'no test skipped at the head that ran at the base');
    assert.deepEqual({ code: f.head.code, fail: f.head.fail }, { code: 0, fail: 0 });
    assert.deepEqual({ code: f.base.code, fail: f.base.fail }, { code: 0, fail: 0 });
  });
}
