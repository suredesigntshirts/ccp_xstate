// still-catches-slow: with capture busy-waiting 250 ms on one PostToolUse run, the serial pass fails on the cheap
// test's p95 bar. Run here: the head's two commands over capture.test.mjs in a temp clone with that edit. Read from
// evidence/still-catches-slow.md: the full npm test record.mjs --slow-capture recorded.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { CAPTURE, CHEAP, HEAD, cleanup, clone, commands, recorded, runCommand, slowCapture } from './lib.mjs';

after(cleanup);

test('slow capture: the parallel command skips the cheap test, the serial command fails on its p95 bar', () => {
  const dir = clone('slow');
  slowCapture(dir);
  const [parallel, serial] = commands();
  const first = runCommand(dir, parallel.replace(/ "test\/.*$/, ` ${CAPTURE}`));
  // --test-skip-pattern leaves a matching test out of the report; anything but skipped would be a result
  assert.deepEqual(first.tests.filter((t) => t.name === CHEAP && t.status !== 'skip'), []);
  const second = runCommand(dir, serial);
  assert.notEqual(second.status, 0);
  assert.deepEqual(second.tests, [{ name: CHEAP, status: 'fail' }]);
  assert.match(second.out, /p95 \d+ ms, of which a bare node start is \d+ ms/);
  assert.doesNotMatch(second.out, /median \d+ ms/, 'the median bar held');
});

test('recorded full npm test with slow capture: it fails, and the failure is the p95 bar in the serial pass', () => {
  const r = recorded('still-catches-slow');
  assert.equal(r.sha, HEAD);
  const [p, s] = r.passes;
  assert.ok(s, 'the serial pass ran');
  assert.notEqual(s.code, 0);
  assert.deepEqual(s.cheap, ['fail']);
  assert.equal(s.failMsgs.length, 1);
  assert.match(s.failMsgs[0], /^p95 \d+ ms, of which a bare node start is \d+ ms$/);
  assert.deepEqual(p.cheap.filter((s) => s !== 'skip'), []);
});
