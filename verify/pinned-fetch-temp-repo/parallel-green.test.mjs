// parallel-green: in a depth-1 clone of the head, the four suites each started three times at once (twelve
// node --test processes), leaving out only the start-timing test files, all pass, and none fails on .git/shallow.lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAD, SUITES, TIMING, origin, runSuite, shallowClone, shallowList, summary } from './lib.mjs';

test('twelve node --test processes over the four suites, timing tests left out, started together, all pass', { timeout: 1_800_000 },
  async (t) => {
    assert.ok(origin(), 'a full origin holding the pinned commits could be made');
    const dir = shallowClone(t);
    const runs = await Promise.all([1, 2, 3].flatMap(() => SUITES.map((s) => runSuite(dir, s, { serial: true, leave: TIMING }))));
    for (const r of runs) t.diagnostic(summary(r));
    const red = runs.filter((r) => r.status !== 0);
    assert.equal(runs.length, 12);
    assert.deepEqual(runs.filter((r) => /shallow\.lock/.test(r.out)).map(summary), [], 'no run names .git/shallow.lock');
    assert.deepEqual(runs.filter((r) => !/^# skipped 0$/m.test(r.out)).map(summary), [], 'no run skips a test');
    assert.deepEqual(red.map(summary), [], red.map((r) => r.out.slice(-2000)).join('\n----\n'));
    assert.deepEqual(shallowList(dir), [HEAD], '.git/shallow still lists only the head');
  });
