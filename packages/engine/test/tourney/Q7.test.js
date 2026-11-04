// Q7 merge outside the host: the PR is merged on GitHub by someone else; the item must not end as verified-done.
// Changed by fix-finish-closes-waits (plan/decisions/2026-11-04-finish-closes-waits.md): it ends closedOutside, not replanning.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, ISSUE, BRIEFS, builds, verifies, tapWake, closedWake } from './world.js';

test('Q7: a merge on GitHub outside the host ends the item closedOutside, with its card closed and no new card; never done', async () => {
  const w = await makeWorld();
  try {
    await w.start('q7', 'quick-fix', { issue: ISSUE });
    assert.ok((await w.agent('q7', 'brief', () => BRIEFS)).accepted);
    await w.drive('q7');
    assert.ok((await w.agent('q7', 'build', builds(w, 1))).accepted);
    await w.drive('q7');
    assert.ok((await w.agent('q7', 'verify', verifies(w, 'PASS'))).accepted);
    await w.drive('q7');
    assert.equal(w.host('q7').snapshot.value, 'awaitingMerge');
    const card = w.cardOf('q7');
    // Someone merges PR 1 on GitHub.
    w.gh.state[1].merged = true;
    await w.drive('q7', closedWake(1));
    let h = w.host('q7');
    // fix-finish-closes-waits: the item ends, and nothing about it waits on the person (it went to replanning before).
    assert.equal(h.snapshot.value, 'closedOutside');
    assert.deepEqual(h.snapshot.context.failure, { closedOutside: 'o/r#1', outcome: 'merged' });
    assert.deepEqual(w.plat.open(), [], 'the approve card is closed, and no replan card went up');
    assert.equal(w.plat.cards.length, 1);
    // The old approve card is closed: a tap on it moves nothing.
    await w.drive('q7', tapWake(card, 0));
    h = w.host('q7');
    assert.equal(h.snapshot.value, 'closedOutside');
    assert.equal(h.snapshot.context.merge, null);
    const states = w.rows('q7').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied').map((r) => r.payload.from);
    assert.ok(!states.includes('"done"'), 'never done');
    assert.equal(w.rows('q7').filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'merge').length, 0, 'the host made no merge');
    assert.deepEqual(w.gh.merges, []);
  } finally {
    await w.close();
  }
});
