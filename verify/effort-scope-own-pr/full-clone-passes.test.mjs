// Expect full-clone-passes: in a full clone of the head with origin/main fetched and PR_BODY unset, the head's suite
// passes and reports tree mode, at the head and on a branch from the head with one more commit outside
// plan-reader-effort's outputs; the base's suite file fails on that branch.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD, MAIN, SUITE, clone, commits, modeLine, runSuite, suiteAt } from './lib.mjs';

const ok = commits();
const STRAY = 'esop-stray-outside-outputs.txt';
const skip = !ok && 'pinned commits unreachable';

test('the head, PR_BODY unset: passes in tree mode', { skip }, (t) => {
  const c = clone(t, HEAD);
  const r = runSuite(c.dir);
  t.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
  assert.equal(r.status, 0, r.out);
  assert.match(modeLine(r.out), /^tree mode/);
});

test('a branch from the head with a stray commit: the head\'s file passes in tree mode, the base\'s fails', { skip }, async (t) => {
  const c = clone(t, HEAD);
  c.git('checkout', '-q', '-b', 'esop-temp');
  c.stray(STRAY);
  await t.test("the head's suite file passes in tree mode", (s) => {
    const r = runSuite(c.dir);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.equal(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^tree mode/);
  });
  await t.test("the base's suite file fails", (s) => {
    c.put(SUITE, suiteAt(MAIN));
    const r = runSuite(c.dir);
    s.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    assert.notEqual(r.status, 0, r.out);
    assert.match(modeLine(r.out), /^PR mode/);
  });
});

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));
