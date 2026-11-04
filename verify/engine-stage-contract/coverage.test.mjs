// Verifier's test for Expect line coverage (plan item engine-stage-contract): the quick-fix verify stage's result is
// checked by the real engine's accept(), through the real hooks (spawn, bind, accept) in the tourney world. A result
// with one Expect line missing, with two lines swapped, and with one line's words changed is each refused with rule
// covers, journalled, and leaves the item verifying; the exact set is accepted and moves the item to awaitingMerge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, BRIEFS, builds } from '../../packages/engine/test/tourney/world.js';

const LINES = ['clamp is exported from math.js', 'clamp throws a RangeError when lo > hi', 'README documents clamp'];
const ISSUE = { url: 'https://github.com/o/r/issues/31', expect: LINES };
const entry = (line) => ({ line, result: 'PASS', evidence: `ran a check for: ${line}` });

test('coverage: missing, swapped and reworded lines are refused as covers; the exact set is accepted', async () => {
  const w = await makeWorld();
  try {
    await w.start('cov', 'quick-fix', { issue: ISSUE });
    assert.ok((await w.agent('cov', 'brief', () => BRIEFS)).accepted);
    await w.drive('cov');
    assert.ok((await w.agent('cov', 'build', builds(w, 3))).accepted);
    await w.drive('cov');
    assert.equal(w.host('cov').snapshot.value, 'verifying');

    const verdict = (lines) => async ({ input, worktree }) => {
      w.checkout(worktree, input.target.at);
      return { result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: input.issue, lines };
    };
    const cases = {
      missing: [entry(LINES[0]), entry(LINES[2])],
      swapped: [entry(LINES[1]), entry(LINES[0]), entry(LINES[2])],
      reworded: [entry(LINES[0]), entry('clamp throws a TypeError when lo > hi'), entry(LINES[2])]
    };
    const reasons = {};
    for (const [name, lines] of Object.entries(cases)) {
      const got = await w.agent('cov', 'verify', verdict(lines), 'ag-cov-v');
      assert.equal(got.accepted, undefined, `${name}: not accepted (${JSON.stringify(got)})`);
      assert.equal(got.refused?.rule, 'covers', `${name}: refused as covers (${JSON.stringify(got)})`);
      reasons[name] = got.refused.reason;
      await w.drive('cov');
      assert.equal(w.host('cov').snapshot.value, 'verifying', `${name}: a refused verdict does not move the item`);
    }
    const refusals = w.rows('cov').filter((r) => r.kind === 'refusal' && r.payload.rule === 'covers');
    assert.equal(refusals.length, 3, 'each refusal is journalled with rule covers');

    const ok = await w.agent('cov', 'verify', verdict(LINES.map(entry)), 'ag-cov-v');
    assert.ok(ok.accepted, JSON.stringify(ok));
    await w.drive('cov');
    assert.equal(w.host('cov').snapshot.value, 'awaitingMerge');
    assert.deepEqual(w.host('cov').snapshot.context.verdict.lines.map((e) => e.line), LINES);
    console.log(JSON.stringify(reasons));
  } finally {
    await w.close();
  }
});
