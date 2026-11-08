// no-checkout-fetch: in a depth-1 clone of the head whose origin serves any sha, the four suites pass and leave
// .git/shallow listing only the head; the base's four files, run in the same clone, add pinned commits to it. The
// start-timing files are left out: npm test runs this beside every other suite, and they time process starts, not fetches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, HEAD, SUITES, TIMING, origin, putFilesAt, runSuite, shallowClone, shallowList, summary } from './lib.mjs';

test('the head four suites pass in a depth-1 clone and never deepen it; the base four do', { timeout: 1_800_000 },
  async (t) => {
    assert.ok(origin(), 'a full origin holding the pinned commits could be made');
    const dir = shallowClone(t);
    assert.deepEqual(shallowList(dir), [HEAD], 'the fresh clone is shallow at the head');

    for (const suite of SUITES) {
      const r = await runSuite(dir, suite, { leave: TIMING });
      t.diagnostic(`head ${summary(r)}`);
      assert.equal(r.status, 0, `${suite} passes at the head:\n${r.out.slice(-3000)}`);
      assert.match(r.out, /^# skipped 0$/m, `${suite} skips nothing, so every pinned commit was read`);
      assert.deepEqual(shallowList(dir), [HEAD], `${suite} left .git/shallow listing only the head`);
    }

    putFilesAt(dir, BASE);
    for (const suite of SUITES) t.diagnostic(`base ${summary(await runSuite(dir, suite, { leave: TIMING }))}`);
    const after = shallowList(dir);
    t.diagnostic(`base files: .git/shallow now lists ${after.length}: ${after.map((s) => s.slice(0, 8)).join(' ')}`);
    assert.ok(after.length > 1 && after.includes(HEAD), 'the base files fetch pinned commits into the clone');
  });
