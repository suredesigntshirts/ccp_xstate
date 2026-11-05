// The stage bench's own tests (plan item stage-bench). No model runs: BENCH_CLAUDE points at fake-claude.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../../../packages/engine/src/stages.js';
import { exportRun } from '../../inspector/export.mjs';
import { REPO, ambientOf, casesOf, readJson, stageInput, specOf, workflowVersion } from '../lib.mjs';
import { benchRun, promptOnly } from '../run.mjs';
import { judgeCheck, noRestatedRules, oneCheckPerLine, reportOf, scoreRuns } from '../score.mjs';
import { blindPacket, compareReport, entryDiff, scoredSet, stageEntry } from '../compare.mjs';

const FAKE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url));
chmodSync(FAKE, 0o755);
const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');
const ADOPT_PIN = readFileSync(join(ADOPT, 'items/trial.jsonl'), 'utf8').match(/"workflow":"quick-fix@([0-9a-f]{64})"/)[1];
const GOOD = { builder: 'Add padLeft to index.js and a README.md section for it and for slugify.', verifier: 'Check 1. "x"' };

/** A fake session's environment: its own config dir for transcripts, its own out dir, the result it returns. */
function fake(result) {
  const dir = mkdtempSync(join(tmpdir(), 'bench-fake-'));
  Object.assign(process.env, { BENCH_CLAUDE: FAKE, CLAUDE_CONFIG_DIR: join(dir, 'config'), FAKE_OUT: join(dir, 'out'), FAKE_RESULT: JSON.stringify(result) });
  return dir;
}

test('same prompt: prompt-only renders every quick-fix stage of the adopt trial byte for byte as its committed brief.md', async () => {
  const version = workflowVersion({ workflow: join(ADOPT, 'blobs', ADOPT_PIN) });
  assert.equal(version.pinned, true);
  for (const name of ['0.brief', '1.build', '3.verify']) {
    const runJson = readJson(join(ADOPT, 'items/trial/runs', name, 'run.json'));
    const got = await promptOnly({ stage: runJson.actor, version, input: runJson.input, runId: runJson.run });
    const committed = readFileSync(join(ADOPT, 'items/trial/runs', name, 'brief.md'), 'utf8');
    assert.equal(got.prompt, committed, name);
    assert.equal(got.prompt, render(runJson), name);
  }
});

test('same prompt: a bench run sends brief.md on stdin, and brief.md is render() of its run.json', async () => {
  const dir = fake(GOOD);
  const [c] = casesOf('brief', 'planted-half-met');
  const out = join(dir, 'runs');
  const bench = await benchRun({ c, k: 1, stage: 'brief', version: workflowVersion(), out });
  const runDir = join(out, 'planted-half-met.1', bench.runFolder);
  const brief = readFileSync(join(runDir, 'brief.md'), 'utf8');
  assert.equal(readFileSync(join(dir, 'out/prompt.txt'), 'utf8'), brief);
  assert.equal(render(readJson(join(runDir, 'run.json'))), brief);
  // the input is the case's, with the workflow's literal task
  const spec = specOf(workflowVersion());
  assert.deepEqual(readJson(join(runDir, 'run.json')).input, stageInput(spec, 'brief', c.input));
  assert.equal(bench.accepted, true);
  assert.equal(bench.firstReturnAccepted, true);
  assert.deepEqual(readJson(join(runDir, 'result.json')).result, GOOD);
  assert.deepEqual(bench.tokens, { input: 10, output: 20, cacheCreation: 30, cacheRead: 40, fresh: 60, total: 100 });
  assert.equal(bench.ambient.reached, true);
  assert.deepEqual(bench.ambient.marks, ['attribution']);
  assert.deepEqual(bench.changed, []);
  assert.ok(existsSync(join(out, 'planted-half-met.1', bench.ambient.systemPrompt.file)));
});

test('alone: the run folder is a journal root the Inspector export replays, with the prompt and the result', async () => {
  const dir = fake(GOOD);
  const [c] = casesOf('brief', 'planted-missing-line');
  const out = join(dir, 'runs');
  await benchRun({ c, k: 2, stage: 'brief', version: workflowVersion(), out });
  const b = await exportRun({ engine: REPO, journal: join(out, 'planted-missing-line.2') });
  assert.equal(b.replay.ok, true);
  const run = b.steps[0].actors.find((a) => a.actor === 'brief');
  assert.equal(run.layers.l2.text, readFileSync(join(out, 'planted-missing-line.2/items/planted-missing-line-2/runs/0.brief/brief.md'), 'utf8'));
  assert.deepEqual(run.layers.l6.result, GOOD);
  assert.equal(run.layers.outcome.status, 'accepted');
});

test('returned: a result the host refuses is handed back, and the second return is accepted', async () => {
  const dir = fake([{ builder: 'only one brief' }, GOOD]);
  const [c] = casesOf('brief', 'planted-half-met');
  const bench = await benchRun({ c, k: 1, stage: 'brief', version: workflowVersion(), out: join(dir, 'runs') });
  assert.equal(bench.accepted, true);
  assert.equal(bench.firstReturnAccepted, false);
  assert.equal(bench.returns[0].refused.rule, 'schema');
});

test('mechanical checks: one check per line, quoted and in order; no branch, base or return mechanics', () => {
  const expect = ['a b', 'c d'];
  assert.equal(oneCheckPerLine({ verifier: 'Check 1. "a b"\nCheck 2. "c d"' }, expect).met, true);
  assert.equal(oneCheckPerLine({ verifier: 'Check 1. "c d"\nCheck 2. "a b"' }, expect).met, false);
  assert.equal(oneCheckPerLine({ verifier: 'Check 1. "a b" and "c d"' }, expect).met, false);
  assert.equal(oneCheckPerLine({ verifier: 'Check 1. "a b"\nCheck 2. "c d"\nCheck 3. npm test' }, expect).met, false);
  assert.equal(oneCheckPerLine({ verifier: 'Check 1. "a b"\nCheck 2. "c d"\n\nAdvisory\n- Check 3. npm test' }, expect).met, true);
  assert.equal(noRestatedRules({ builder: 'Commit and open the pull request.', verifier: 'Check out the PR head.' }).met, true);
  for (const bad of ['git checkout -b feat/x', 'git push -u origin x', 'The branch name must match feat/<n>', 'open the PR against main', 'call the harness return tool']) {
    assert.equal(noRestatedRules({ builder: bad, verifier: '' }).met, false, bad);
  }
});

test('score: mechanical then judge per criterion; verdicts are kept and reused while prompt and model are the same', async () => {
  const dir = fake(GOOD);
  const out = join(dir, 'runs');
  const [c] = casesOf('brief', 'planted-half-met');
  await benchRun({ c, k: 1, stage: 'brief', version: workflowVersion(), out });
  writeFileSync(join(out, 'set.json'), JSON.stringify({ k: 1 }));
  const first = await scoreRuns({ stage: 'brief', dir: out, model: 'fake-judge' });
  const calls = () => readFileSync(join(dir, 'out/judge-calls.jsonl'), 'utf8').trim().split('\n').length;
  assert.equal(calls(), 4);
  const s = first[0].score;
  assert.equal(s.returned.met, true);
  assert.equal(s['one-check-per-line'].met, false);
  assert.equal(s['words-only'].met, true);
  assert.deepEqual(readJson(join(out, 'planted-half-met.1/score.json')).criteria, s);
  await scoreRuns({ stage: 'brief', dir: out, model: 'fake-judge' });
  assert.equal(calls(), 4, 'kept verdicts are reused');
  await scoreRuns({ stage: 'brief', dir: out, model: 'other-judge' });
  assert.equal(calls(), 8, 'another judge model asks again');
  const md = reportOf({ stage: 'brief', dir: out, scored: first });
  assert.match(md, /\| one-check-per-line \| mechanical \| 0\/1 \|/);
  assert.match(md, /Ambient instructions reached 1 of 1 runs \(attribution\)/);
});

test('judge-checked: a planted-bad extra entry graded met is reported as a miss', async () => {
  const dir = fake(GOOD);
  const extra = join(dir, 'mine.json');
  writeFileSync(extra, JSON.stringify({ case: 'planted-half-met', result: { builder: 'b', verifier: 'v' }, grades: { 'words-only': false }, planted: { 'words-only': 'planted' } }));
  const got = await judgeCheck({ stage: 'brief', extra: [extra], out: join(dir, 'judged'), model: 'fake-judge' });
  assert.ok(got.misses.some((m) => m.entry === 'mine' && m.criterion === 'words-only'));
  assert.equal(got.agreement['words-only'].disagree.includes('mine'), true);
});

test('compare: two versions, per case and criterion, with the rule that changed and a blind packet', async () => {
  const dir = fake(GOOD);
  const [c] = casesOf('brief', 'planted-half-met');
  const a = join(dir, 'a');
  const b = join(dir, 'b');
  const variant = join(dir, 'quick-fix.json');
  const qf = JSON.parse(readFileSync(join(REPO, 'workflows/quick-fix.json'), 'utf8'));
  const was = qf.meta.actors.brief.rules[4];
  qf.meta.actors.brief.rules[4] = `${was} (variant)`;
  writeFileSync(variant, JSON.stringify(qf, null, 2));
  await benchRun({ c, k: 1, stage: 'brief', version: workflowVersion(), out: a });
  await benchRun({ c, k: 1, stage: 'brief', version: workflowVersion({ workflow: variant }), out: b });
  for (const d of [a, b]) await scoreRuns({ stage: 'brief', dir: d, model: 'fake-judge' });
  const A = scoredSet(a);
  const B = scoredSet(b);
  assert.deepEqual(entryDiff(stageEntry(A, 'brief'), stageEntry(B, 'brief')), [`- rule removed: ${was}`, `+ rule added: ${was} (variant)`]);
  const { md, worse } = compareReport({ stage: 'brief', a: A, b: B, aDir: a, bDir: b });
  assert.match(md, /\| words-only \| 1\/1 \| 1\/1 \| same \|/);
  assert.deepEqual(worse, []);
  const { packet, key } = blindPacket({ stage: 'brief', a: A, b: B, seed: 3 });
  assert.match(packet, /## Case planted-half-met/);
  assert.doesNotMatch(packet, /quick-fix|workflow version|\bA\b run|\bB\b run/);
  assert.deepEqual(Object.keys(key.key), ['planted-half-met']);
});

test('ambientOf: marks found in the recorded system prompt or the context attachments', () => {
  const t = (rows) => rows.map((r) => JSON.stringify(r)).join('\n');
  assert.deepEqual(ambientOf(''), { recorded: false, reached: false, marks: [], attachments: [], systemPrompt: null });
  const got = ambientOf(t([{ type: 'attachment', attachment: { type: 'skill_listing' }, rendered: [{ content: 'The following skills are available for use' }] }, { type: 'attachment', attachment: { type: 'prompt_snapshot', systemPrompt: ['plain'] } }]));
  assert.equal(got.reached, true);
  assert.deepEqual(got.marks, ['skills']);
  assert.equal(got.systemPrompt, 'plain');
});

test('cases: at least 6, 2 real and 3 planted, each with must_catch and must_not', () => {
  const cs = casesOf('brief');
  assert.ok(cs.length >= 6);
  assert.ok(cs.filter((c) => c.kind === 'real').length >= 2);
  assert.ok(cs.filter((c) => c.kind === 'planted').length >= 3);
  for (const c of cs) {
    assert.ok(c.must_catch.length && c.must_not.length, c.id);
    assert.ok(Array.isArray(c.input.issue.expect) && c.input.issue.expect.length, c.id);
  }
});

// A copy of the case folder is used so the cases stay untouched by any test.
test('caseRepo: a seed case becomes a one-commit repository with the case origin', async () => {
  const { caseRepo } = await import('../lib.mjs');
  const [c] = casesOf('brief', 'planted-after-merge');
  const work = mkdtempSync(join(tmpdir(), 'bench-case-'));
  cpSync(c.dir, join(work, 'case'), { recursive: true });
  const repo = caseRepo({ ...c, dir: join(work, 'case') }, work);
  const { execFileSync } = await import('node:child_process');
  assert.equal(execFileSync('git', ['-C', repo, 'rev-list', '--count', 'HEAD'], { encoding: 'utf8' }).trim(), '1');
  assert.equal(execFileSync('git', ['-C', repo, 'remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim(), 'https://github.com/o/greet-cli.git');
  assert.ok(existsSync(join(repo, '.github/workflows/pages.yml')));
});
