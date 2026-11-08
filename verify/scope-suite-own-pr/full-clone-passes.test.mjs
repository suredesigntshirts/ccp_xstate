// Expect full-clone-passes: in a full clone with origin/main fetched and PR_BODY unset, the head's suite passes and
// says it checked the scope from the tree, at the head and at origin/main's commit with the head's file copied in; the
// base's suite file fails at both.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEAD, MAIN, READY, clone, commits, modeLine, runSuite, suiteAt, SUITE } from './lib.mjs';

const ok = commits();
const cases = [
  ['the head', HEAD, HEAD, 0],
  ["origin/main's commit with the head's file", MAIN, HEAD, 0],
  ["the head with the base's file", HEAD, READY, 1],
  ["origin/main's commit with the base's file", MAIN, READY, 1],
];

for (const [name, at, file, want] of cases) {
  test(`${name}: ${want === 0 ? 'passes in tree mode' : 'fails'}`, { skip: !ok && 'pinned commits unreachable' }, (t) => {
    const c = clone(t, at);
    c.put(SUITE, suiteAt(file));
    const r = runSuite(c.dir);
    t.diagnostic(`exit ${r.status}; ${modeLine(r.out)}`);
    if (want === 0) {
      assert.equal(r.status, 0, r.out);
      assert.match(modeLine(r.out), /^tree mode/);
    } else {
      assert.notEqual(r.status, 0, r.out);
      assert.match(modeLine(r.out), /^PR mode/);
    }
  });
}

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));
