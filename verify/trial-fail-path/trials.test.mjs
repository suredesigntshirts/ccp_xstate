// Verifier's tests for plan item trial-fail-path, one block per Expect id (ci is read from GitHub, not tested here).
// Run: node --test verify/trial-fail-path/   (the driver re-run writes only under a fresh mkdtemp folder in TMPDIR)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, TRIALS, load, inputOf, extraLines, refusals, reportRuleTable, stageRecord, deepEqual } from './lib.mjs';

const fail = load('fail');
const blocked = load('blocked');
const event = (t, n) => t.applied[n].payload.event;
const B1 = '8b25414f65c91c4ee83398a177633c571e0daa6e';
const B2 = '06d7cc88d126cec5c616090c59c1430b6c6bba44';

test('both journals replay on the quick-fix they pinned (restore re-runs every transition and checks its hash)', () => {
  for (const t of [fail, blocked]) {
    assert.ok(t.applied.length > 0);
    assert.equal(t.pin, `quick-fix@${t.workflowHash}`);
    for (const r of t.applied) assert.equal(r.payload.workflow, `quick-fix@${t.workflowHash}`);
  }
});

test('fail-loop: brief, injected build 1, verify FAIL, build 2 with that verdict, verify PASS at the new head, approve, merged, done', () => {
  assert.deepEqual(fail.states, ['briefing', 'building', 'checking', 'verifying', 'building', 'checking', 'verifying', 'awaitingMerge', 'merging', 'done']);
  assert.equal(fail.host.snapshot.value, 'done');

  // build 1: the injected answer, accepted as the run's result, PR #1 at B1
  const inject = fail.log.filter((r) => r.kind === 'inject');
  assert.equal(inject.length, 1);
  assert.equal(inject[0].run, 'trial:1.build');
  assert.equal(inject[0].sha, B1);
  assert.deepEqual(JSON.parse(fail.answers['trial_1.build.injected.json']), { pr: { url: 'https://github.com/o/r/pull/1', at: B1 } });
  const b1 = event(fail, 2);
  assert.equal(b1.type, 'xstate.done.actor.build');
  assert.equal(b1.output.pr.at, B1);
  assert.deepEqual(b1.output, fail.runs['1.build'].result.result);
  assert.deepEqual(event(fail, 3), { head_sha: B1, pr: 'o/r#1', type: 'github.check_suite.completed' });

  // verify 1: FAIL at B1, at least one line FAIL, the accepted result is the event the engine took
  const v1 = event(fail, 4);
  assert.equal(v1.type, 'xstate.done.actor.verify');
  assert.equal(v1.output.result, 'FAIL');
  assert.equal(v1.output.pr.at, B1);
  assert.deepEqual(v1.output.lines.filter((l) => l.result === 'FAIL').map((l) => l.line), ['percent(part, whole) throws a RangeError when whole is 0']);
  assert.deepEqual(v1.output, fail.runs['3.verify'].result.result);

  // build 2: its stage record shows that verdict and build 1's PR; its brief.md carries them under Inputs
  const b2run = fail.runs['4.build'];
  const verdict = inputOf(b2run, 'verdict');
  assert.equal(verdict.from, 'context.verdict');
  assert.equal(verdict.producer.run, 'trial:3.verify');
  assert.equal(verdict.producer.transition, 'trial#4');
  assert.deepEqual(verdict.value, v1.output);
  const previous = inputOf(b2run, 'previous');
  assert.equal(previous.producer.run, 'trial:1.build');
  assert.equal(previous.value.url, 'https://github.com/o/r/pull/1');
  assert.equal(previous.value.at, B1);
  assert.ok(b2run.brief.includes(`- verdict: `) && b2run.brief.includes('"result":"FAIL"') && b2run.brief.includes(`"at":"${B1}"`));
  // context.md holds only the run line (by the stage contract), and that line names a fresh branch at main
  assert.match(b2run.context, /^Run trial:4\.build, worktree \S+ of https:\/\/github\.com\/o\/r, branch run\/trial\/4\.build\.$/);

  const b2 = event(fail, 5);
  assert.equal(b2.output.pr.url, 'https://github.com/o/r/pull/1');
  assert.equal(b2.output.pr.at, B2);
  assert.deepEqual(b2.output, b2run.result.result);
  assert.deepEqual(event(fail, 6), { head_sha: B2, pr: 'o/r#1', type: 'github.check_suite.completed' });

  // verify 2: PASS at B2 on the same PR, every line PASS, given that PR as its target
  const v2 = event(fail, 7);
  assert.equal(v2.output.result, 'PASS');
  assert.equal(v2.output.pr.at, B2);
  assert.equal(v2.output.pr.key, 'o/r#1');
  assert.ok(v2.output.lines.length === 4 && v2.output.lines.every((l) => l.result === 'PASS'));
  assert.equal(inputOf(fail.runs['6.verify'], 'target').value.at, B2);

  // card tapped approve, merge at verify 2's head, fake GitHub shows it
  assert.equal(event(fail, 8).type, 'xstate.done.actor.ask');
  assert.equal(event(fail, 8).output.choice, 'approve');
  const merge = fail.rows.find((r) => r.kind === 'engine.effect' && r.payload.effect === 'trial:8.merge' && r.payload.phase === 'done');
  assert.equal(merge.payload.outcome.head, B2);
  assert.deepEqual(fail.gh.merges, [{ number: 1, sha: B2, base: 'main' }]);
  assert.equal(fail.gh.prs['1'].merged, true);
  assert.equal(fail.gh.prs['1'].head, B2);
  assert.deepEqual(Object.keys(fail.gh.prs), ['1']);
  assert.deepEqual(fail.gh.pushes.map((p) => [p.branch, p.sha]), [['run/trial/1.build', B1], ['run/trial/1.build', B2]]);
  assert.equal(fail.gh.suites[B1][0].conclusion, 'success');
  assert.equal(fail.gh.suites[B2][0].conclusion, 'success');
});

test('blocked-route: build returns blocked naming the refused push, item at replanning, card carries "build blocked: <reason>"', () => {
  assert.deepEqual(blocked.states, ['briefing', 'building', 'replanning']);
  assert.equal(blocked.host.snapshot.value, 'replanning');
  const reason = blocked.runs['1.build'].result.result.blocked.reason;
  assert.deepEqual(Object.keys(blocked.runs['1.build'].result.result), ['blocked']);
  assert.match(reason, /push was refused/);
  assert.ok(reason.includes('refusing to allow an OAuth App to create or update workflow `.github/workflows/test.yml` without `workflow` scope'));
  const ev = event(blocked, 2);
  assert.equal(ev.type, 'xstate.error.actor.build');
  assert.equal(ev.error, `build blocked: ${reason}`);
  assert.equal(blocked.host.snapshot.context.failure, `build blocked: ${reason}`);
  // the replanning ask's input as the workflow wires it, and as the driver's platform received it
  assert.equal(blocked.spec.states.replanning.invoke.input.failure, 'context.failure');
  const asks = blocked.log.filter((r) => r.kind === 'item.asks');
  assert.equal(asks.length, 1);
  assert.equal(asks[0].state, 'replanning');
  assert.equal(asks[0].input.failure, `build blocked: ${reason}`);
  assert.equal(asks[0].input.verdict, null);
  // the origin's refusal, and the push output the builder saw
  const refused = readFileSync(join(blocked.dir, 'run/refused-pushes.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(refused.length, 1);
  assert.equal(refused[0].file, '.github/workflows/test.yml');
  const seen = readFileSync(join(blocked.dir, 'run/builder-push.txt'), 'utf8');
  assert.ok(seen.includes(`remote: ${refused[0].message}`));
  assert.ok(seen.includes('! [remote rejected] run/trial/1.build -> run/trial/1.build (pre-receive hook declined)'));
  assert.ok(seen.includes(refused[0].sha) && reason.includes(refused[0].sha));
  assert.deepEqual(blocked.gh, { prs: {}, suites: {}, merges: [], pushes: [] });
});

test('real-agents: each pending prompt is brief.md + context.md with one blank separator line and nothing else', () => {
  for (const t of [fail, blocked]) {
    assert.deepEqual(Object.keys(t.pending).sort(), Object.keys(t.runs).sort());
    for (const [run, prompt] of Object.entries(t.pending)) {
      const r = t.runs[run];
      const { extra, missing } = extraLines(prompt, r.brief, r.context);
      assert.deepEqual(missing, [], `${run}: nothing of brief.md/context.md is left out`);
      assert.deepEqual(extra.map((e) => e.text), [''], `${run}: the only extra line is the blank separator`);
      assert.equal(prompt, `${r.brief}\n\n${r.context}`);
      // the agent's raw answer is the accepted result (no unwrap, no edit), except the injected build
      const answer = Object.entries(t.answers).find(([f]) => f.startsWith(`trial_${run}.`));
      assert.deepEqual(JSON.parse(answer[1].match(/\{[\s\S]*\}/)[0]), stripStamped(r.result.result), `${run}: answer == accepted result`);
    }
  }
  // only build 1 of fail was injected; the driver has no other way to answer a run than reading an answer file
  assert.deepEqual(fail.log.filter((r) => r.kind === 'inject').map((r) => r.run), ['trial:1.build']);
  assert.deepEqual(blocked.log.filter((r) => r.kind === 'inject'), []);
  for (const t of [fail, blocked]) assert.ok(t.log.filter((r) => r.kind === 'accept').every((r) => r.unwrapped === false));
});

// The answer files hold what the agent returned; accept() stamps key/checkout/green onto refs.
function stripStamped(v) {
  return JSON.parse(JSON.stringify(v, function (k, x) { return ['key', 'checkout', 'green'].includes(k) && typeof this?.url === 'string' ? undefined : x; }));
}

test('real-agents: the injected build 1 diff, applied to the driver\'s seed repo, misses exactly expect line 2', () => {
  // Re-run the fail driver up to its first hand-off in a temp tree (its journal path is ../journal, so copy it out).
  const tmp = mkdtempSync(join(process.env.TMPDIR ?? tmpdir(), 'tfp-'));
  const tree = join(tmp, 'r');
  const drv = join(tree, 'tournaments/2026-11-04-stage-contract/trials/fail/driver');
  mkdirSync(drv, { recursive: true });
  cpSync(join(TRIALS, 'fail/driver'), drv, { recursive: true });
  // A copy, not a link: the engine finds workflows/ beside its own real path, so a linked engine would read this
  // checkout's workflows/ and not the pinned bytes written below.
  cpSync(join(REPO, 'packages'), join(tree, 'packages'), { recursive: true, filter: (src) => !src.includes('node_modules') });
  symlinkSync(join(REPO, 'node_modules'), join(tree, 'node_modules'));
  // The driver loads workflows/quick-fix.json: give it the bytes the committed journal pinned, so the re-run starts
  // on the same workflow whatever the file says today (plan item stage-bench).
  cpSync(join(REPO, 'workflows'), join(tree, 'workflows'), { recursive: true });
  writeFileSync(join(tree, 'workflows/quick-fix.json'), readFileSync(join(fail.root, 'blobs', fail.workflowHash)));
  const T = join(tmp, 'trial');
  execFileSync('node', [join(drv, 'drive.mjs'), 'init'], { env: { ...process.env, TRIAL_DIR: T }, encoding: 'utf8', timeout: 120000 });
  const p0 = readFileSync(join(T, 'pending/trial_0.brief.prompt.md'), 'utf8').replaceAll(T, '/home/user/trial-fail');
  assert.equal(p0, fail.pending['0.brief'], 'the re-run starts with the committed first prompt, byte for byte');

  const wt = join(tmp, 'b1');
  execFileSync('git', ['clone', '-q', join(T, 'world/origin.git'), wt]);
  // injected.diff was written with its final newline trimmed; git apply needs it back
  execFileSync('git', ['-C', wt, 'apply', '--index', '-'], { input: `${readFileSync(join(TRIALS, 'fail/run/injected.diff'), 'utf8')}\n` });
  const run = (code) => execFileSync('node', ['-e', code], { cwd: wt, encoding: 'utf8' }).trim();
  // line 1: exported, rounds to two places
  assert.equal(run("const {percent}=require('./math.js');console.log([[1,4],[1,3],[2,3],[50,200],[1,7],[-1,3]].map(([a,b])=>percent(a,b)).join(' '))"), '25 33.33 66.67 25 14.29 -33.33');
  // line 2: no RangeError for whole 0
  assert.equal(run("const {percent}=require('./math.js');console.log([[5,0],[0,0],[-3,0]].map(([a,b])=>{try{return String(percent(a,b))}catch(e){return e.name}}).join(' '))"), 'Infinity NaN -Infinity');
  // line 3: the heading inside ## API, before ## Tests
  const readme = readFileSync(join(wt, 'README.md'), 'utf8');
  const api = readme.slice(readme.indexOf('## API'), readme.indexOf('## Tests'));
  assert.ok(api.split('\n').includes('### percent(part, whole)'));
  // line 4: npm test passes
  execFileSync('npm', ['test'], { cwd: wt, stdio: 'pipe' });
});

test('refusals-counted: refused accept rows by rule in each journal and driver log equal the report tables', () => {
  for (const t of [fail, blocked]) {
    const r = refusals(t);
    const table = reportRuleTable(t.report);
    assert.ok(Object.keys(table).length >= 9);
    for (const [rule, n] of Object.entries(table)) {
      assert.equal(r.journal[rule] ?? 0, n, `journal ${rule}`);
      assert.equal(r.driver[rule] ?? 0, n, `driver log ${rule}`);
    }
    assert.deepEqual(Object.keys(r.journal).filter((k) => !(k in table)), [], 'no refusal of a rule the table leaves out');
    assert.equal(r.unparsable, 0);
    assert.equal(r.accepts, Object.keys(t.runs).length, 'one accept per model run: none sent back');
    // the report says, per run, whether the agent needed anything beyond its prompt
    assert.match(t.report, /## Did the prompts carry the agents (through )?without coaching\?\n\n(Yes|No)\./);
    // (fail's injected build 1 has no agent, so no section; its row in the run table says "injected")
    const injected = t.log.filter((r) => r.kind === 'inject').map((r) => r.run.replace(/^trial:/, ''));
    for (const run of Object.keys(t.runs).filter((n) => !injected.includes(n))) assert.ok(t.report.includes(`### ${run}`), `report has a section for ${run}`);
    for (const run of injected) assert.match(t.report, new RegExp('\\| `trial:' + run.replace('.', '\\.') + '` \\| injected \\|'));
  }
  // negative control: the counter sees the adopt trial's one restated refusal
  const adopt = load('adopt', { replay: false });
  assert.deepEqual(refusals(adopt).journal, { restated: 1 });
});

test('stage-record: every model run has stage.json, and assemble(prompt.parts) is brief.md byte for byte', () => {
  for (const t of [fail, blocked]) {
    const rec = stageRecord(t);
    assert.equal(rec.length, Object.keys(t.runs).length);
    for (const r of rec) assert.deepEqual(r, { run: r.run, hasStage: true, assembled: true, hash: true, context: true });
  }
  // every model-actor run effect the journals started has a run folder
  for (const t of [fail, blocked]) {
    const started = t.rows.filter((r) => r.kind === 'engine.effect' && r.payload.type === 'run' && r.payload.phase === 'start' && ['brief', 'build', 'verify'].includes(r.payload.actor)).map((r) => r.payload.effect.replace(/^trial:/, ''));
    assert.deepEqual(started.sort(), Object.keys(t.runs).sort());
  }
  // negative control: one changed byte in brief.md is caught
  const r = structuredClone(fail.runs['4.build']);
  r.brief = r.brief.replace('verdict', 'verdicT');
  assert.equal(stageRecord({ runs: { x: r } })[0].assembled, false);
});
