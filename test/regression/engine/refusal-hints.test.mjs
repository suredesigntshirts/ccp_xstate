// Expect: fix-refusal-hints/hint, fix-refusal-hints/restated, fix-refusal-hints/cap
// A refused result carries fix.hint, each line a field's ## Output line from the stage file; a restated refusal names every differing key path; the 10th refusal fails the run and the item takes onError. Quick-fix items on the real engine (the tourney world).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test } from 'node:test';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');

const ISSUE = {
  url: 'https://github.com/o/r/issues/42',
  title: 'Add clamp',
  body: 'Please add clamp(x, lo, hi) to math.js.',
  expect: ['clamp is exported from math.js', 'clamp throws a RangeError when lo > hi', 'README documents clamp']
};

/** The `## Output` line of a top-level field, read from workflows/quick-fix/<stage>.md as the person wrote it. */
function outputLine(stage, field, repo = REPO) {
  const md = readFileSync(join(repo, 'workflows', 'quick-fix', `${stage}.md`), 'utf8');
  const part = md.slice(md.indexOf('## Output'));
  const line = part.split('\n').find((l) => l.startsWith(`- ${field}: `));
  assert.ok(line, `${stage}.md ## Output has a ${field} line`);
  return line.slice(`- ${field}: `.length);
}

async function engineOf(repo = REPO) {
  const world = await import(pathToFileURL(join(repo, 'packages/engine/test/tourney/world.js')).href);
  const actors = await import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
  return { ...world, A: actors };
}

/** A quick-fix item driven to building (build run open) or verifying (verify run open). */
async function at(E, w, id, where) {
  await w.start(id, 'quick-fix', { issue: ISSUE });
  assert.ok((await w.agent(id, 'brief', () => E.BRIEFS)).accepted);
  await w.drive(id);
  if (where === 'building') { assert.equal(w.host(id).snapshot.value, 'building'); return; }
  assert.ok((await w.agent(id, 'build', E.builds(w, 1))).accepted);
  await w.drive(id);
  if (w.host(id).snapshot.value !== 'verifying') await w.drive(id, E.suiteWake(w.host(id).snapshot.context.pr.at));
  assert.equal(w.host(id).snapshot.value, 'verifying');
}

/** A verify result built from its input, changed by `bad`. */
const verifyResult = (w, bad = (r) => r) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return bad({
    result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: structuredClone(input.issue),
    lines: input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: `checked: ${line}` }))
  }, input);
};

/** The hint scenarios of the Expect line `hint`: accept()'s full answer for each. */
async function hintScenarios(repo = REPO) {
  const E = await engineOf(repo);
  const out = {};
  const w = await E.makeWorld();
  try {
    await at(E, w, 'v1', 'verifying');
    out.shortAt = await w.agent('v1', 'verify', verifyResult(w, (r) => ({ ...r, pr: { ...r.pr, at: r.pr.at.slice(0, 7) } })), 'ag-v1');
    out.twoFields = await w.agent('v1', 'verify', verifyResult(w, (r) => { const { lines, ...rest } = r; return { ...rest, pr: { ...r.pr, at: r.pr.at.slice(0, 7) } }; }), 'ag-v1');
    out.covers = await w.agent('v1', 'verify', verifyResult(w, (r) => ({ ...r, lines: r.lines.slice(0, 2) })), 'ag-v1');
    await at(E, w, 'b1', 'building');
    out.buildProse = await w.agent('b1', 'build', async ({ worktree }) => {
      const head = w.commit(worktree, 'build');
      return { pr: { url: 'I opened the pull request on GitHub, see the repo', at: head } };
    }, 'ag-b1');
  } finally { await w.close(); }
  return out;
}

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


test('hint: short pr.at, two fields, build prose url and covers each get the named fields\' Output lines', async () => {
  const got = await hintScenarios();
  assert.equal(got.shortAt.refused.rule, 'schema');
  assert.match(got.shortAt.refused.reason, /result\.pr\.at/);
  assert.deepEqual(got.shortAt.fix.hint, [`pr: ${outputLine('verify', 'pr')}`]);
  assert.deepEqual([...got.twoFields.fix.hint].sort(), [`lines: ${outputLine('verify', 'lines')}`, `pr: ${outputLine('verify', 'pr')}`].sort());
  assert.equal(got.twoFields.fix.hint.length, 2, 'no hint for issue or result');
  assert.equal(got.buildProse.refused.rule, 'schema');
  assert.deepEqual(got.buildProse.fix.hint, [`pr: ${outputLine('build', 'pr')}`]);
  assert.notEqual(outputLine('build', 'pr'), outputLine('verify', 'pr'), 'the build stage\'s own pr line, not verify\'s');
  assert.equal(got.covers.refused.rule, 'covers');
  assert.deepEqual(got.covers.fix.hint, [`lines: ${outputLine('verify', 'lines')}`]);
  for (const k of Object.keys(got)) assert.equal(got[k].fix.cap, 10, k);
});

test('restated: one line, an added key, url and a line, a long value; then the echo is accepted', async () => {
  const E = await engineOf();
  const w = await E.makeWorld();
  try {
    await at(E, w, 'r1', 'verifying');
    const ret = (issueOf) => w.agent('r1', 'verify', verifyResult(w, (r) => ({ ...r, issue: issueOf(structuredClone(r.issue)) })), 'ag-r1');

    const changed = 'clamp throws a TypeError when lo > hi';
    const one = await ret((i) => { i.expect[1] = changed; return i; });
    assert.equal(one.refused.rule, 'restated');
    assert.ok(one.refused.reason.includes(`result.issue.expect[1] is ${JSON.stringify(changed)}`), one.refused.reason);
    assert.ok(one.refused.reason.includes(`the input's issue.expect[1] is ${JSON.stringify(ISSUE.expect[1])}`), one.refused.reason);
    assert.ok(!one.refused.reason.includes('expect[0]') && !one.refused.reason.includes('expect[2]'), 'only the differing line');
    assert.ok(one.fix.hint.some((h) => h.startsWith('issue: ')), 'restated gets the issue hint');

    const added = await ret((i) => ({ ...i, labels: ['bug'] }));
    assert.equal(added.refused.rule, 'restated');
    assert.match(added.refused.reason, /result\.issue\.labels is not in the input/);

    const both = await ret((i) => ({ ...i, url: 'https://github.com/o/r/issues/43', expect: [i.expect[0], changed, i.expect[2]] }));
    assert.equal(both.refused.rule, 'restated');
    assert.match(both.refused.reason, /result\.issue\.url is "https:\/\/github\.com\/o\/r\/issues\/43"/);
    assert.match(both.refused.reason, /result\.issue\.expect\[1\] is/);

    const long = 'x'.repeat(500);
    const cut = await ret((i) => { i.expect[2] = long; return i; });
    assert.equal(cut.refused.rule, 'restated');
    const shown = cut.refused.reason.match(/result\.issue\.expect\[2\] is (.*?), the input's/)[1];
    assert.ok(shown.length <= 201 && shown.length >= 200, `cut to 200 (+ ellipsis): ${shown.length}`);
    assert.ok(!cut.refused.reason.includes('x'.repeat(250)));

    const ok = await ret((i) => i);
    assert.ok(ok.accepted, JSON.stringify(ok));
  } finally { await w.close(); }
});
