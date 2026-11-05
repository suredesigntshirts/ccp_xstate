// Expect cap: result refusals are counted per run from the item's journal; the 10th fails the run (failed.json,
// a refusal-cap row), an 11th is refused already-failed, and the item, offered resultsOf, takes verify's onError
// (replanning). Cap 10 since replan #124. wrong-caller, unknown-run and already-returned refusals do not count; 9 refusals then a good
// result is accepted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { at, engineOf, verifyResult } from './lib.mjs';

const CAP = 10;
const shortAt = (w) => verifyResult(w, (r) => ({ ...r, pr: { ...r.pr, at: r.pr.at.slice(0, 7) } }));

test('cap: 9 open, the 10th fails the run, the 11th is already-failed, the item takes onError', async () => {
  const E = await engineOf();
  const w = await E.makeWorld();
  try {
    await at(E, w, 'c1', 'verifying');
    const runId = w.openRun('c1', 'verify').id;
    for (let i = 1; i < CAP; i++) {
      const got = await w.agent('c1', 'verify', shortAt(w), 'ag-c1');
      assert.equal(got.refused.rule, 'schema');
      assert.deepEqual([got.fix.count, got.fix.cap], [i, CAP], `refusal ${i}`);
      assert.equal(got.failed, undefined);
      // A refusal that is not about the result, between each: does not count.
      const wc = await E.A.accept({ root: w.root, caller: 'intruder', run: runId, result: {}, toolUseId: `wc${i}`, github: w.gh.client });
      assert.equal(wc.refused.rule, 'wrong-caller');
      assert.equal(wc.fix, undefined);
      const un = await E.A.accept({ root: w.root, caller: 'ag-c1', run: 'no-such-run', result: {}, toolUseId: `un${i}`, github: w.gh.client });
      assert.equal(un.refused.rule, 'unknown-run');
      await w.drive('c1');
      assert.equal(w.host('c1').snapshot.value, 'verifying', `open after ${i}`);
    }
    const eighth = await w.agent('c1', 'verify', shortAt(w), 'ag-c1');
    assert.equal(eighth.refused.rule, 'schema');
    assert.deepEqual([eighth.fix.count, eighth.fix.cap], [CAP, CAP]);
    assert.equal(eighth.failed, runId);
    const text = E.A.refusalText(eighth);
    assert.match(text, /Refusal 10 of 10\./);
    assert.match(text, /has failed/);
    assert.match(text, /do not call the return tool again/);

    const runRows = w.rows('c1').filter((r) => r.kind === 'refusal' && r.payload.run === runId);
    const cap = runRows.filter((r) => r.payload.rule === 'refusal-cap');
    assert.equal(cap.length, 1);
    assert.equal(cap[0].payload.outcome, 'failed');
    const counted = runRows.filter((r) => r.payload.count);
    assert.deepEqual(counted.map((r) => r.payload.count), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.ok(counted.every((r) => r.payload.cap === CAP && r.payload.hint?.length === 1));
    assert.equal(runRows.filter((r) => r.payload.rule === 'wrong-caller').length, CAP - 1, 'wrong-caller journalled, not counted');

    const files = (await import('node:child_process')).execFileSync('find', [w.root, '-name', 'failed.json'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
    assert.equal(files.length, 1, files.join());
    const failed = JSON.parse(readFileSync(files[0], 'utf8'));
    assert.ok(failed.why.startsWith('refused 10 times'), failed.why);
    for (const r of counted) assert.ok(failed.why.includes(`${r.payload.rule}: ${r.payload.reason}`));
    assert.equal(failed.why.match(/\d+\. schema: /g).length, CAP);

    const ninth = await w.agent('c1', 'verify', shortAt(w), 'ag-c1');
    assert.equal(ninth.refused.rule, 'already-failed');
    assert.equal(ninth.fix, undefined);
    const good = await w.agent('c1', 'verify', verifyResult(w), 'ag-c1');
    assert.equal(good.refused?.rule, 'already-failed', 'a good result after the cap is still refused');

    const host = w.host('c1');
    const inputs = E.resultsOf(host);
    assert.ok(inputs.some((i) => i.event.type.startsWith('xstate.error.actor.') && String(i.event.error).startsWith('refused 10 times')), JSON.stringify(inputs));
    await E.offer(host, inputs, w.handlersFor(host));
    assert.equal(w.host('c1').snapshot.value, 'replanning');
    assert.match(String(w.host('c1').snapshot.context.failure), /^refused 10 times/);
  } finally { await w.close(); }
});

test('cap: 9 refusals then a good result is accepted; already-returned does not count', async () => {
  const E = await engineOf();
  const w = await E.makeWorld();
  try {
    await at(E, w, 'c2', 'verifying');
    for (let i = 1; i < CAP; i++) assert.equal((await w.agent('c2', 'verify', shortAt(w), 'ag-c2')).fix.count, i);
    const ok = await w.agent('c2', 'verify', verifyResult(w), 'ag-c2');
    assert.ok(ok.accepted, JSON.stringify(ok));
    const runId = ok.accepted.run;
    for (let i = 0; i < 3; i++) {
      const again = await E.A.accept({ root: w.root, caller: 'ag-c2', run: runId, result: {}, toolUseId: `ar${i}`, github: w.gh.client });
      assert.equal(again.refused.rule, 'already-returned');
      assert.equal(again.fix, undefined);
    }
    await w.drive('c2');
    assert.equal(w.host('c2').snapshot.value, 'awaitingMerge');
    assert.equal(w.rows('c2').filter((r) => r.payload?.rule === 'refusal-cap').length, 0);
  } finally { await w.close(); }
});
