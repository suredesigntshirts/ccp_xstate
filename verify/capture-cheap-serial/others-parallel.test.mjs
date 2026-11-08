// others-parallel: the parallel pass runs the base's files at the default concurrency, and every test the base ran
// ends there as it did at the base, but the cheap test, skipped. Tests of files the head adds are not compared. The script is compared here; the per-test results
// of the base's npm test and the head's parallel pass, recorded by record.mjs, are read from evidence/others-parallel.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, CAPTURE, CHEAP, commands, recorded } from './lib.mjs';

test("the parallel pass is the base's command with only the skip pattern added", () => {
  assert.equal(commands()[0], BASE.script.replace('node --test ', 'node --test --test-skip-pattern="^cheap: " '));
});

test("recorded: the same files, and every test's result the same but the cheap test's, now skipped", () => {
  const r = recorded('others-parallel');
  assert.equal(r.base.sha, BASE.sha);
  // The head adds one file, the builder's own test of the two passes; no file the base ran is missing.
  assert.deepEqual(r.missing, []);
  assert.deepEqual(r.added, ['test/test-passes.test.mjs']);
  assert.equal(r.base.files + 1, r.head.files);
  // --test-skip-pattern leaves the cheap test out of the report: absent, which is skipped and nothing else.
  assert.deepEqual(r.changed.filter((c) => !r.flaky.includes(c.key)), [{ key: `${CAPTURE} :: ${CHEAP}`, base: 'pass', head: 'absent' }]);
  assert.equal(r.base.code, 0);
  assert.equal(r.head.code, 0);
});
