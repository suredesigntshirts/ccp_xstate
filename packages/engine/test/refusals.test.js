// fix-refusal-hints: a refused return says how to fix it (the named fields' own Output lines), a restated refusal
// names every key that differs with both values, and a run's result refusals are capped: the one that reaches the cap
// fails the run, so its item takes the invoke's error. Through the real engine, on quick-fix's verify stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { accept, differences, refusalText, REFUSAL_CAP, resultsOf, runDir } from '../src/actors.js';
import { makeWorld, ISSUE, BRIEFS, builds, verifies } from './tourney/world.js';
import { stageOf } from './tourney/contract.js';

const verify = stageOf('quick-fix', 'verify');
const build = stageOf('quick-fix', 'build');
const line = (stage, field) => `${field}: ${stage.properties[field].description}`;

// A quick-fix item at verifying, with its verify run's agent bound by a first, refused, return.
async function atVerify(w, item, issue = ISSUE) {
  await w.start(item, 'quick-fix', { issue });
  await w.agent(item, 'brief', () => BRIEFS); await w.drive(item);
  await w.agent(item, 'build', builds(w, 1)); await w.drive(item);
  assert.equal(w.host(item).snapshot.value, 'verifying');
  return w.openRun(item, 'verify');
}
const good = (w) => verifies(w);
const tamper = (w, change) => async (args) => { const r = await good(w)(args); change(r, args.input); return r; };

test('hint: each field the reason names gets its Output line once; the reason is unchanged', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 'h');
    const short = await w.agent('h', 'verify', tamper(w, (r) => { r.pr.at = r.pr.at.slice(0, 7); }), 'ag-h');
    assert.deepEqual(short.refused, { rule: 'schema', reason: 'verify result: result.pr.at is shorter than 40' }, 'the reason as on main');
    assert.deepEqual(short.fix, { hint: [line(verify, 'pr')], count: 1, cap: REFUSAL_CAP });
    const two = await w.agent('h', 'verify', tamper(w, (r) => { r.pr.at = 'x'; delete r.lines; }), 'ag-h');
    assert.deepEqual(two.fix.hint, [line(verify, 'pr'), line(verify, 'lines')], 'pr and lines, in the schema order, once each');
    assert.equal(two.fix.count, 2);
    const covers = await w.agent('h', 'verify', tamper(w, (r) => { r.lines = []; r.lines.push({ line: 'another', result: 'PASS', evidence: 'e' }); }), 'ag-h');
    assert.equal(covers.refused.rule, 'covers');
    assert.deepEqual(covers.fix.hint, [line(verify, 'lines')]);
    const row = w.rows('h').filter((r) => r.kind === 'refusal').at(-1);
    assert.deepEqual([row.payload.hint, row.payload.count, row.payload.cap], [[line(verify, 'lines')], 3, REFUSAL_CAP], 'the row carries hint, count and cap');
    const text = refusalText(covers);
    assert.equal(text, `covers: ${covers.refused.reason}\nHow to fix it, from your Output:\n- ${line(verify, 'lines')}\nRefusal 3 of ${REFUSAL_CAP}.`);
  } finally { await w.close(); }
});

test('hint: a build result with a prose url gets the build stage\'s pr line', async () => {
  const w = await makeWorld();
  try {
    await w.start('b', 'quick-fix', { issue: ISSUE });
    await w.agent('b', 'brief', () => BRIEFS); await w.drive('b');
    const got = await w.agent('b', 'build', () => ({ pr: { url: 'opened it', at: 'a'.repeat(40) } }));
    assert.equal(got.refused.rule, 'schema');
    assert.deepEqual(got.fix.hint, [line(build, 'pr')]);
  } finally { await w.close(); }
});

test('restated: names every differing key with both values, cut to 200 characters', async () => {
  const issue = { url: ISSUE.url, expect: ['a works', 'b works'] };
  const w = await makeWorld();
  try {
    await atVerify(w, 'r', issue);
    const one = await w.agent('r', 'verify', tamper(w, (r) => { r.issue = { ...r.issue, expect: ['a works', 'b fails'] }; }), 'ag-r');
    assert.equal(one.refused.rule, 'restated');
    assert.match(one.refused.reason, /: result\.issue\.expect\[1\] is "b fails", the input's issue\.expect\[1\] is "b works"$/);
    assert.deepEqual(one.fix.hint, [line(verify, 'issue')]);
    const added = await w.agent('r', 'verify', tamper(w, (r) => { r.issue = { ...r.issue, labels: ['bug'] }; }), 'ag-r');
    assert.match(added.refused.reason, /: result\.issue\.labels is not in the input's issue$/);
    const both = await w.agent('r', 'verify', tamper(w, (r) => { r.issue = { url: 'https://github.com/o/r/issues/8', expect: ['a works', 'c'] }; }), 'ag-r');
    assert.match(both.refused.reason, /result\.issue\.url is "https:\/\/github\.com\/o\/r\/issues\/8", the input's issue\.url is "https:\/\/github\.com\/o\/r\/issues\/7"; result\.issue\.expect\[1\] is "c", the input's issue\.expect\[1\] is "b works"$/);
    const long = differences('x'.repeat(500), 'y', 'result.k', 'k')[0];
    assert.equal(long, `result.k is "${'x'.repeat(199)}…, the input's k is "y"`);
    assert.deepEqual(differences(['a'], ['a', 'b'], 'result.l', 'l'), ['result.l is ["a"], the input\'s l is ["a","b"]'], 'arrays of different length are named whole');
    assert.ok((await w.agent('r', 'verify', good(w), 'ag-r')).accepted, 'the exact echo is accepted');
  } finally { await w.close(); }
});

test('cap: the refusal that reaches the cap fails the run, and the item takes the invoke\'s error', async () => {
  const w = await makeWorld();
  try {
    const run = await atVerify(w, 'c');
    const bad = tamper(w, (r) => { r.pr.at = 'short'; });
    // Refusals that are not about the result do not count.
    await w.agent('c', 'verify', bad, 'ag-c');
    const other = await accept({ root: w.root, caller: 'intruder', run: run.id, result: {}, github: w.gh.client, web: w.web });
    assert.deepEqual([other.refused.rule, other.fix], ['wrong-caller', undefined]);
    for (let n = 2; n < REFUSAL_CAP; n++) {
      const got = await w.agent('c', 'verify', bad, 'ag-c');
      assert.deepEqual([got.fix.count, got.failed], [n, undefined]);
    }
    assert.ok(!existsSync(join(runDir(w.root, run.id), 'failed.json')), 'open below the cap');
    const last = await w.agent('c', 'verify', bad, 'ag-c');
    assert.deepEqual([last.fix.count, last.failed], [REFUSAL_CAP, run.id]);
    assert.match(refusalText(last), new RegExp(`Refusal ${REFUSAL_CAP} of ${REFUSAL_CAP}\\.\\nRun .* has failed after ${REFUSAL_CAP} refusals: do not call the return tool again`));
    const failed = JSON.parse(readFileSync(join(runDir(w.root, run.id), 'failed.json'), 'utf8'));
    assert.match(failed.why, new RegExp(`^refused ${REFUSAL_CAP} times: 1\\. schema: .* ${REFUSAL_CAP}\\. schema: `));
    assert.equal(w.rows('c').filter((r) => r.kind === 'refusal' && r.payload.rule === 'refusal-cap').length, 1);
    const again = await w.agent('c', 'verify', bad, 'ag-c');
    assert.deepEqual(again.refused, { rule: 'already-failed', reason: `run ${run.id} failed: its result was refused ${REFUSAL_CAP} times` });
    assert.equal(resultsOf(w.host('c'))[0].event.type, 'xstate.error.actor.verify');
    await w.drive('c');
    assert.equal(w.host('c').snapshot.value, 'replanning', 'quick-fix verifying took its onError');
  } finally { await w.close(); }
});

test('cap: a run refused one short of the cap is still accepted', async () => {
  const w = await makeWorld();
  try {
    await atVerify(w, 'a');
    for (let n = 1; n < REFUSAL_CAP; n++) await w.agent('a', 'verify', tamper(w, (r) => { r.result = 'MAYBE'; }), 'ag-a');
    assert.ok((await w.agent('a', 'verify', good(w), 'ag-a')).accepted);
  } finally { await w.close(); }
});
