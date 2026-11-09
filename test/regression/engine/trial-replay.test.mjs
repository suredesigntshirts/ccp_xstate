// Expect: trial-fail-path/fail-loop, trial-fail-path/blocked-route
// The fail and blocked trials' journals, under tournaments/, replayed through the engine's restore() on the quick-fix
// they pinned: every transition re-runs and checks its hash, the fail loop ends done after a FAIL and a rebuild, and
// the blocked build ends at replanning with the refused push as its reason.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { restore } from '../../../packages/engine/src/host.js';
import { loadWorkflow } from '../../../packages/engine/src/index.js';

// Helpers for the tests below.
const REPO = new URL('../../../', import.meta.url).pathname;
const TRIALS = join(REPO, 'tournaments/2026-11-04-stage-contract/trials');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const json = (f) => JSON.parse(readFileSync(f, 'utf8'));
const lines = (f) => (existsSync(f) ? readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : []);

function load(name, { replay = true } = {}) {
  const dir = join(TRIALS, name);
  const root = join(dir, 'journal');
  const rows = lines(join(root, 'items', 'trial.jsonl'));
  // The item replays on the workflow blob its journal pinned (a later edit of
  // workflows/quick-fix.json must not change what a finished item replays on). The pin is the seq-0 row's workflow.
  const pin = rows.find((r) => r.kind === 'engine.transition' && r.payload.seq === 0)?.payload.workflow;
  const spec = replay ? loadWorkflow(pin, { root }) : null;
  const host = replay ? restore({ root, item: 'trial', spec, session: 'verifier', release: 'verifier' }) : null;
  const applied = rows.filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied').sort((a, b) => a.payload.seq - b.payload.seq);
  const runsDir = join(root, 'items', 'trial', 'runs');
  const runs = Object.fromEntries(readdirSync(runsDir).sort((a, b) => parseInt(a) - parseInt(b)).map((n) => {
    const d = join(runsDir, n);
    const f = (x) => (existsSync(join(d, x)) ? readFileSync(join(d, x), 'utf8') : null);
    return [n, { dir: d, brief: f('prompt.md') ?? f('brief.md'), context: f('context.md'), stage: f('stage.json') && JSON.parse(f('stage.json')), result: f('result.json') && JSON.parse(f('result.json')) }];
  }));
  const pendingDir = join(dir, 'run', 'pending');
  const pending = Object.fromEntries(readdirSync(pendingDir).filter((f) => f.endsWith('.prompt.md')).map((f) => [f.replace(/^trial_/, '').replace(/\.prompt\.md$/, ''), readFileSync(join(pendingDir, f), 'utf8')]));
  const answersDir = join(dir, 'run', 'answers');
  const answers = Object.fromEntries(readdirSync(answersDir).map((f) => [f, readFileSync(join(answersDir, f), 'utf8')]));
  return {
    dir, root, rows, spec, host, applied, runs, pending, answers,
    pin,
    // The hash of the pinned bytes as committed under the journal's blobs/ (loadWorkflow also checks it).
    workflowHash: sha256(readFileSync(join(root, 'blobs', String(pin).split('@')[1]))),
    states: applied.map((r) => JSON.parse(r.state)),
    log: lines(join(dir, 'run', 'driver-log.jsonl')),
    shim: lines(join(dir, 'run', 'shim-calls.jsonl')),
    gh: json(join(dir, 'run', 'gh-state.json')),
    report: readFileSync(join(dir, 'report.md'), 'utf8')
  };
}

/** The value a run's stage.json says it was given for input `name`. */
const inputOf = (run, name) => run.stage.inputs.find((i) => i.name === name);

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

