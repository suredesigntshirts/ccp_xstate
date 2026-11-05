// Expect cap: two blocks per run, counted in the journal; the third Stop fails the run and the item steps back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, briefRun, engine } from './lib.mjs';

test('cap: blocks 1 and 2 (stop_hook_active either way), the third fails the run: stalled:, stall-cap row, replanning, not waiting, ccp-run refused already-failed', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  const b1 = p.stop('S', { stop_hook_active: false });
  assert.ok(b1.reason.includes('Block 1 of 2.'));
  const b2 = p.stop('S', { stop_hook_active: true });
  assert.equal(b2.decision, 'block');
  assert.ok(b2.reason.includes('Block 2 of 2.'));
  assert.deepEqual((await p.refusals('a-1', 'stall')).map((r) => r.payload.count), [1, 2]);
  assert.equal(p.failed(run), null);
  const b3 = p.stop('S', { stop_hook_active: true });
  assert.equal(b3, null, 'the third stop is let through');
  const f = p.failed(run);
  assert.ok(f?.why.startsWith('stalled:'), JSON.stringify(f));
  const cap = await p.refusals('a-1', 'stall-cap');
  assert.equal(cap.length, 1);
  assert.equal(cap[0].payload.outcome, 'failed');
  assert.equal(p.show('a-1').state, 'replanning');
  const A = await engine();
  assert.equal(A.waiting(p.root, 'a-1').length, 0);
  const deny = p.agent(`ccp-run ${run}`, 'S');
  assert.equal(deny.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(deny.hookSpecificOutput.permissionDecisionReason, /^already-failed/);
  assert.equal(p.files(run).includes('spawn.json'), false);
  // Later stops: nothing waits for S, so no block and no new row.
  assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1', 'stall')).length, 2);
  assert.equal((await p.refusals('a-1', 'stall-cap')).length, 1);
});

test('cap: two waiting runs block one at a time; one run\'s count does not use up the other\'s', async () => {
  const p = project({ items: ['a-1', 'b-1'], owner: 'S' });
  const [ra, rb] = [briefRun(p, 'a-1'), briefRun(p, 'b-1')];
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const out = p.stop('S');
    seen.push(out ? `${out.reason.match(/run (\S+) prepared/)[1]} ${out.reason.match(/Block \d of 2/)[0]}` : null);
  }
  assert.deepEqual(seen, [`${ra} Block 1 of 2`, `${ra} Block 2 of 2`, `${rb} Block 1 of 2`, `${rb} Block 2 of 2`, null, null]);
  assert.ok(p.failed(ra).why.startsWith('stalled:'));
  assert.ok(p.failed(rb).why.startsWith('stalled:'));
  assert.equal(p.show('a-1').state, 'replanning');
  assert.equal(p.show('b-1').state, 'replanning');
  assert.deepEqual((await p.refusals('a-1', 'stall')).map((r) => r.payload.count), [1, 2]);
  assert.deepEqual((await p.refusals('b-1', 'stall')).map((r) => r.payload.count), [1, 2]);
});

test('cap: a run started after one block is not failed later, and the other run still gets its own two', async () => {
  const p = project({ items: ['a-1', 'b-1'], owner: 'S' });
  const [ra, rb] = [briefRun(p, 'a-1'), briefRun(p, 'b-1')];
  assert.ok(p.stop('S').reason.includes(ra));
  p.agent(`ccp-run ${ra}`, 'S');
  const n = p.stop('S');
  assert.ok(n.reason.includes(rb) && n.reason.includes('Block 1 of 2.'));
  assert.equal(p.failed(ra), null);
});
