// green-under-suite: the cheap test passes in three of three full npm test runs at the head (recorded by
// record.mjs, read from evidence/green-under-suite.md), and capture.test.mjs run on its own still runs and passes it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE, CHEAP, HEAD, ROOT, recorded, runCommand } from './lib.mjs';

test('node --test plugins/harness/test/capture.test.mjs on its own runs and passes the cheap test', () => {
  const r = runCommand(ROOT, `node --test ${CAPTURE}`);
  assert.deepEqual(r.tests.filter((t) => t.name === CHEAP).map((t) => t.status), ['pass'], r.out.slice(-2000));
});

test('recorded: three of three full npm test runs at the head pass, the cheap test with them', () => {
  const r = recorded('green-under-suite');
  assert.equal(r.runs.length, 3);
  for (const run of r.runs) {
    assert.equal(run.sha, HEAD);
    assert.deepEqual(run.passes.map((p) => p.code), [0, 0]);
    assert.deepEqual(run.passes[1].cheap, ['pass']);
  }
});
