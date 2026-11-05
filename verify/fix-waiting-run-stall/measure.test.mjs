// Expect measure: derive.js stalls over a journal whose runs the verifier chose, made by the real hook and engine:
// a never blocked (started first), b blocked once then started, c failed at the cap, d failed by cannot-start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { project, briefRun, engine, DERIVE } from './lib.mjs';

const derive = (journal) => JSON.parse(execFileSync(process.execPath, [DERIVE(), 'stalls', '--journal', journal], { encoding: 'utf8' }));

test('measure: prepared 4, blocked 2, blocks 3, startedAfterBlock 1, failedAtCap 1, cannotStart 1, rate 0.5', async () => {
  const A = await engine();
  const p = project({ items: ['a-1', 'b-1', 'c-1', 'd-1'], owner: 'S' });
  const r = Object.fromEntries(['a-1', 'b-1', 'c-1', 'd-1'].map((i) => [i, briefRun(p, i)]));
  const start = (run) => { p.agent(`ccp-run ${run}`, 'S', `tu-${run}`); A.bind({ root: p.root, agentId: `ag-${run}`, toolUseId: `tu-${run}`, session: 'S' }); };
  start(r['a-1']);
  p.agent(`ccp-cannot-start ${r['d-1']}: no Agent tool in this session`, 'S');
  assert.ok(p.stop('S').reason.includes(r['b-1']));
  start(r['b-1']);
  assert.ok(p.stop('S').reason.includes(`${r['c-1']} prepared`));
  assert.ok(p.stop('S').reason.includes('Block 2 of 2.'));
  assert.equal(p.stop('S'), null);
  const view = derive(p.root);
  const { runs, ...counts } = view;
  assert.deepEqual(counts, { prepared: 4, blocked: 2, blocks: 3, startedAfterBlock: 1, failedAtCap: 1, cannotStart: 1, rate: 0.5 });
  const by = Object.fromEntries(runs.map((e) => [e.run, e]));
  assert.deepEqual([by[r['b-1']].blocks, by[r['b-1']].startedAfterBlock, by[r['b-1']].failed], [1, true, null]);
  assert.deepEqual([by[r['c-1']].blocks, by[r['c-1']].startedAfterBlock, by[r['c-1']].failed], [2, false, 'stall-cap']);
  assert.deepEqual([by[r['d-1']].blocks, by[r['d-1']].failed], [0, 'cannot-start']);
  // Expect: "with a per-run entry for each" of the four runs, the never-blocked one included.
  assert.deepEqual(runs.map((e) => e.run).sort(), Object.values(r).sort(), 'a per-run entry for each of the four runs');
  assert.deepEqual([by[r['a-1']].blocks, by[r['a-1']].failed], [0, null]);
  // One item's file alone gives that item's view.
  const one = derive(join(p.root, 'items', 'c-1.jsonl'));
  assert.deepEqual([one.prepared, one.blocked, one.blocks, one.failedAtCap, one.rate], [1, 1, 2, 1, 1]);
});
