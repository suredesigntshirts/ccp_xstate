// Expect: tournament-kit/generic, tournament-kit/pinned, tournament-scoring-floors/args-refuse, tournament-scoring-floors/rescore, tournament-scoring-floors/floors, tournament-scoring-floors/primitive-rule, tournament-scoring-floors/no-single-count
// The design-tournament kit builds runner args from a folder and refuses one missing a pinned field, runs a toy
// tournament through the runner with stub agents, and scores lanes by floors and trade-offs, on toy folders and on a
// real tournament's recorded judge and measure files.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

{
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const KIT = path.join(ROOT, 'scripts/tournament');
const TOY = path.join(HERE, '../fixtures/tournament/2026-11-04-readme-structure');

function kitFiles(dir = KIT) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? kitFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

function buildToyArgs() {
  const r = spawnSync(process.execPath, [path.join(KIT, 'args.mjs'), TOY], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

test('args.mjs builds valid args from the toy folder', () => {
  const a = buildToyArgs();
  assert.equal(a.id, '2026-11-04-readme-structure');
  assert.match(a.question, /README/);
  assert.match(a.pack, /newcomer/);
  assert.deepEqual(a.stages.map((s) => [s.id, s.role, s.over]), [['sketch', 'designer', 'each'], ['verdict', 'judge', 'all']]);
  assert.deepEqual(Object.keys(a.roles).sort(), ['designer', 'judge']);
  assert.ok(a.roles.designer.prompt.length > 0 && a.roles.judge.prompt.length > 0);
  assert.equal(a.lanes.length, 3);
});

/** A stub of the Workflow tool's hooks. */
async function runRunner(args, answer) {
  const src = fs.readFileSync(path.join(KIT, 'runner.workflow.js'), 'utf8').replace(/^export const meta =/m, 'const meta =');
  const calls = [];
  const phases = [];
  const hooks = {
    args,
    agent: async (prompt, opts = {}) => {
      calls.push({ prompt, ...opts });
      return answer(prompt, opts);
    },
    pipeline: async (items, ...steps) =>
      Promise.all(items.map(async (item, i) => {
        let v = item;
        for (const s of steps) v = await s(v, item, i);
        return v;
      })),
    parallel: async (thunks) => Promise.all(thunks.map((t) => t())),
    phase: (p) => phases.push(p),
    log: () => {},
    budget: { total: null, spent: () => 0, remaining: () => Infinity }
  };
  const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
  const result = await new AsyncFunction(...Object.keys(hooks), src)(...Object.values(hooks));
  return { result, calls, phases };
}

test('the toy tournament runs through the runner with stub agents to a result', async () => {
  const args = buildToyArgs();
  const { result, calls, phases } = await runRunner(args, async (prompt, opts) => {
    if (opts.label.startsWith('sketch:')) {
      const lane = opts.label.slice('sketch:'.length);
      return { designFile: `/tmp/${lane}.md`, summary: `outline by ${lane}` };
    }
    return { scores: [], ranking: ['Q', 'T', 'R'], bestIdeas: [{ lane: 'Q', idea: 'sections as questions' }] };
  });
  assert.deepEqual(calls.map((c) => c.label).sort(), ['sketch:Q-question-led', 'sketch:R-reference-first', 'sketch:T-tutorial-first', 'verdict'].sort());
  assert.deepEqual(phases, ['Sketch', 'Verdict']);
  const sketchT = calls.find((c) => c.label === 'sketch:T-tutorial-first');
  assert.match(sketchT.prompt, /How should a project README be structured/);
  assert.match(sketchT.prompt, /Tutorial-first/);
  assert.match(sketchT.prompt, /per hundred README lines/, 'scoring rule comes from args');
  assert.ok(sketchT.schema, 'designer schema passed');
  const verdict = calls.find((c) => c.label === 'verdict');
  assert.match(verdict.prompt, /outline by R-reference-first/, 'judge sees the lanes outputs');
  assert.doesNotMatch(verdict.prompt, /\{\{/);
  assert.equal(result.id, '2026-11-04-readme-structure');
  assert.deepEqual(result.result.ranking, ['Q', 'T', 'R']);
  assert.equal(result.lanes['T-tutorial-first'].sketch.summary, 'outline by T-tutorial-first');
});
}

{
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const ARGS = path.join(ROOT, 'scripts/tournament/args.mjs');
const TOY = path.join(HERE, '../fixtures/tournament/2026-11-04-readme-structure');
const ID = path.basename(TOY);

const FIELDS = [['base'], ['base', 'repo'], ['base', 'sha'], ['lanes'], ['stages'], ['scoring'], ['scoring', 'floors'], ['scoring', 'tradeoffs'], ['runner'], ['runner', 'sha']];

function present(c, p) {
  let v = c;
  for (const k of p) v = v?.[k];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '';
}

test('every tournaments/<id>/config.json records the pinned fields', () => {
  const dir = path.join(ROOT, 'tournaments');
  const ids = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'config.json')));
  assert.ok(ids.includes('2026-11-03-context'));
  for (const id of ids) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, id, 'config.json'), 'utf8'));
    for (const f of FIELDS) assert.ok(present(c, f), `${id}: ${f.join('.')} missing`);
    assert.match(c.base.sha, /^[0-9a-f]{40}$/);
    assert.match(c.runner.sha, /^[0-9a-f]{40}$/);
    // and the real folder builds
    const r = spawnSync(process.execPath, [ARGS, path.join(dir, id)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${id}: ${r.stderr}`);
  }
});

function runWithout(fieldPath, mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vtk-pinned-'));
  const folder = path.join(tmp, ID);
  fs.cpSync(TOY, folder, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(folder, 'config.json'), 'utf8'));
  let o = c;
  for (const k of fieldPath.slice(0, -1)) o = o[k];
  const last = fieldPath[fieldPath.length - 1];
  if (mode === 'delete') delete o[last];
  else o[last] = Array.isArray(o[last]) ? [] : '';
  fs.writeFileSync(path.join(folder, 'config.json'), JSON.stringify(c));
  const r = spawnSync(process.execPath, [ARGS, folder], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return r;
}

test('the untouched toy folder is accepted (control)', () => {
  const r = spawnSync(process.execPath, [ARGS, TOY], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

for (const f of FIELDS) {
  for (const mode of ['delete', 'empty']) {
    test(`args.mjs refuses a config with ${f.join('.')} ${mode === 'delete' ? 'deleted' : 'emptied'}`, () => {
      const r = runWithout(f, mode);
      assert.notEqual(r.status, 0, `accepted without ${f.join('.')}`);
      assert.match(r.stderr, /refused/);
      assert.equal(r.stdout.trim(), '', 'no args printed');
    });
  }
}
}

{
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const argsCli = path.join(repo, 'scripts/tournament/args.mjs');

const run = (folder) => spawnSync(process.execPath, [argsCli, folder], { cwd: repo, encoding: 'utf8' });

function copyWith(folder, edit) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-tsf-args-')), path.basename(folder));
  fs.cpSync(folder, dir, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  edit(c);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(c, null, 2));
  return dir;
}

for (const folder of [path.join(repo, 'tournaments/2026-11-03-context'), path.join(here, '../fixtures/tournament/2026-11-04-recipe-cards')]) {
  const name = path.basename(folder);
  test(`args: ${name} builds args, with its scoring as floors and trade-offs`, () => {
    const c = JSON.parse(fs.readFileSync(path.join(folder, 'config.json'), 'utf8'));
    assert.ok(c.scoring.floors && Array.isArray(c.scoring.tradeoffs) && c.scoring.tradeoffs.length >= 2);
    const r = run(folder);
    assert.equal(r.status, 0, r.stderr);
    const args = JSON.parse(r.stdout);
    assert.match(args.scoring.text, /^Floors/);
  });

  test(`args: ${name} with its floors removed is refused`, () => {
    const r = run(copyWith(folder, (c) => delete c.scoring.floors));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /floors/);
  });

  test(`args: ${name} with empty floors, one trade-off, or only a free-text rule is refused`, () => {
    for (const edit of [
      (c) => (c.scoring.floors = {}),
      (c) => (c.scoring.floors = { scenarios: [], contractTests: [], constraints: [] }),
      (c) => (c.scoring.tradeoffs = c.scoring.tradeoffs.slice(0, 1)),
      (c) => (c.scoring = { rule: 'Rank on weighted primitive count alone.' })
    ]) {
      const r = run(copyWith(folder, edit));
      assert.equal(r.status, 1, `expected refusal for ${edit}`);
    }
  });
}
}

{
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const folder = path.join(repo, 'tournaments/2026-11-04-stage-contract');
const judge = path.join(here, '../fixtures/tournament/rescore/judge-round2.json');
const scores = path.join(here, '../fixtures/tournament/rescore/scores-round2.json');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

function rescore(scoresFile = scores) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-tsf-rescore-'));
  const md = execFileSync(process.execPath, [path.join(repo, 'scripts/tournament/score.mjs'), folder, '--judge', judge, '--scores', scoresFile, '--out', out], { cwd: repo, encoding: 'utf8' });
  return { md, r: readJson(path.join(out, 'scoring.json')) };
}

test('rescore: A is not qualified for want of contract tests; S and M qualify', () => {
  const { r, md } = rescore();
  assert.deepEqual(r.qualified, ['S-six-parts', 'M-minimal']);
  assert.deepEqual(r.notQualified, ['A-control']);
  const failed = r.floors['A-control'].failed;
  assert.deepEqual(failed.filter((f) => f.kind === 'contractTests').map((f) => f.id), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  assert.ok(failed.every((f) => f.kind !== 'scenarios'), 'A passes every scenario');
  assert.match(md, /\| A-control \| no \| contractTests P1: /);
});

test('rescore: the trade-off table holds primitives under the counting rule, promptInEngine S 8471 / M 9021, and trials S 2 / M 0', () => {
  const { r, md } = rescore();
  assert.equal(r.table['S-six-parts'].promptInEngine.value, 8471);
  assert.equal(r.table['M-minimal'].promptInEngine.value, 9021);
  assert.equal(r.table['S-six-parts'].trials.text, '2 passed of 2');
  assert.equal(r.table['M-minimal'].trials.text, '0 passed of 0');
  const S = r.table['S-six-parts'].primitives.detail;
  const M = r.table['M-minimal'].primitives.detail;
  // covers is used by the two verify stages only: a special case, not dropped.
  assert.ok(S.special.some((p) => p.name === 'covers field attribute' && /2 of 8 model stages/.test(p.why)));
  assert.ok(!S.counted.some((p) => p.name === 'covers field attribute'));
  // child item lives in feature only: special for both lanes.
  for (const d of [S, M]) assert.ok(d.special.some((p) => p.name === 'child item' && /one workflow \(feature\)/.test(p.why)));
  // Stage parts every model stage uses count.
  for (const n of ['rules part', 'task part', 'inputs part (name to meaning)', 'checkStages load-time check']) assert.ok(S.counted.some((p) => p.name === n), n);
  assert.equal(r.table['S-six-parts'].primitives.text, '12 counted (13 weighted), 13 special');
  assert.equal(r.table['M-minimal'].primitives.text, '13 counted (14 weighted), 12 special');
  // S is at least as good on all three and better on each: it ranks above M, with all three columns shown.
  assert.deepEqual(r.beats, { 'S-six-parts': ['M-minimal'], 'M-minimal': [] });
  assert.match(md, /\| S-six-parts \| 12 counted \(13 weighted\), 13 special \| 8471 \| 2 passed of 2 \| M-minimal \|/);
  assert.match(md, /\| M-minimal \| 13 counted \(14 weighted\), 12 special \| 9021 \| 0 passed of 0 \| none \|/);
});
}

{
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../..');
const toy = path.join(here, '../fixtures/tournament/2026-11-04-recipe-cards');
const scoreCli = path.join(repo, 'scripts/tournament/score.mjs');
const { score } = await import(path.join(repo, 'scripts/tournament/score.mjs'));

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'verify-tsf-'));

function runToy(judge) {
  const out = tmp();
  const args = [scoreCli, toy, '--out', out];
  if (judge) args.push('--judge', judge);
  const md = execFileSync(process.execPath, args, { cwd: repo, encoding: 'utf8' });
  return { md, json: readJson(path.join(out, 'scoring.json')), mdFile: fs.readFileSync(path.join(out, 'scoring.md'), 'utf8') };
}

test('floors: each lane failing one kind of floor is not qualified, with that floor named', () => {
  const { json, md } = runToy();
  assert.deepEqual(json.qualified.sort(), ['P-pass', 'Q-lean', 'R-untried']);
  assert.deepEqual(json.notQualified.sort(), ['X-scenario', 'Y-contract', 'Z-constraint']);
  const only = (id) => json.floors[id].failed.map((f) => `${f.kind}:${f.id}`);
  assert.deepEqual(only('X-scenario'), ['scenarios:S2']);
  assert.deepEqual(only('Y-contract'), ['contractTests:C1']);
  assert.deepEqual(only('Z-constraint'), ['constraints:H1']);
  for (const id of ['P-pass', 'Q-lean', 'R-untried']) assert.deepEqual(json.floors[id], { qualified: true, failed: [] });
  // Named in the Markdown too.
  assert.match(md, /\| X-scenario \| no \| scenarios S2: /);
  assert.match(md, /\| Y-contract \| no \| contractTests C1: /);
  assert.match(md, /\| Z-constraint \| no \| constraints H1: /);
});

test('floors: whatever its primitive count or other costs, a lane that fails a floor is not in the trade-off table', () => {
  // Z has no primitives, 1 prompt byte and two passed trials: it would beat every lane on every cost.
  const { json, md } = runToy();
  assert.equal(json.table['Z-constraint'], undefined);
  assert.ok(!json.tiers.flat().includes('Z-constraint'));
  const tradeoffSection = md.split('## Trade-offs')[1];
  assert.doesNotMatch(tradeoffSection, /Z-constraint|X-scenario|Y-contract/);
});

test('floors: a floor the judge leaves out, or reports with a non-true pass, counts as failed', () => {
  const judge = readJson(path.join(toy, 'judge.json'));
  const p = judge.scores.find((e) => e.lane === 'P');
  p.floors = p.floors.filter((f) => f.id !== 'S1');
  const q = judge.scores.find((e) => e.lane === 'Q');
  q.floors.find((f) => f.id === 'H1').pass = 'yes';
  const f = path.join(tmp(), 'judge.json');
  fs.writeFileSync(f, JSON.stringify(judge));
  const { json } = runToy(f);
  assert.deepEqual(json.floors['P-pass'].failed.map((x) => x.id), ['S1']);
  assert.match(json.floors['P-pass'].failed[0].why, /not reported/);
  assert.deepEqual(json.floors['Q-lean'].failed.map((x) => x.id), ['H1']);
  assert.deepEqual(json.qualified, ['R-untried']);
});

test('primitive-rule: counted only if every model stage uses it in more than one workflow; the rest are special cases', () => {
  const { json, mdFile } = runToy();
  const P = json.table['P-pass'].primitives.detail;
  assert.deepEqual(P.counted.map((x) => x.name).sort(), ['source-ref', 'step-list']);
  assert.equal(P.count, 2);
  assert.equal(P.weighted, 3); // source-ref weighs 2
  assert.deepEqual(P.special.map((x) => x.name).sort(), ['fraction-table', 'menu-week-grid', 'print-css']);
  const why = Object.fromEntries(P.special.map((x) => [x.name, x.why]));
  assert.match(why['fraction-table'], /2 of 4 model stages/);
  assert.match(why['menu-week-grid'], /1 of 4 model stages/);
  assert.match(why['menu-week-grid'], /one workflow \(menu\)/);
  assert.match(why['print-css'], /no model stage/);

  // Lane Q's model stages all sit in workflow card: a primitive every stage uses but only in card is special;
  // one also used outside a stage in menu counts.
  const Q = json.table['Q-lean'].primitives.detail;
  assert.deepEqual(Q.counted.map((x) => x.name), ['source-ref']);
  const qwhy = Object.fromEntries(Q.special.map((x) => [x.name, x.why]));
  assert.match(qwhy['step-list'], /one workflow \(card\)/);
  assert.doesNotMatch(qwhy['step-list'], /model stages/);
  assert.match(qwhy['inline-units'], /1 of 2 model stages/);

  // Nothing dropped silently: every primitive the judge listed is either counted or special.
  const judge = readJson(path.join(toy, 'judge.json'));
  for (const [laneId, alias] of [['P-pass', 'P'], ['Q-lean', 'Q'], ['R-untried', 'R']]) {
    const listed = judge.scores.find((e) => e.lane === alias).primitives.map((x) => x.name).sort();
    const d = json.table[laneId].primitives.detail;
    assert.deepEqual([...d.counted, ...d.special].map((x) => x.name).sort(), listed);
  }
  // And the special cases are printed in scoring.md.
  for (const name of ['fraction-table', 'menu-week-grid', 'print-css', 'inline-units']) assert.match(mdFile, new RegExp(`- ${name}: `));
});

test('no-single-count: a lane better on one trade-off only does not rank above another; the table shows all three', () => {
  const { json, md } = runToy();
  // Q has fewer primitives than P but more prompt bytes: neither ranks above the other.
  assert.ok(!json.beats['Q-lean'].includes('P-pass'));
  assert.ok(!json.beats['P-pass'].includes('Q-lean'));
  assert.deepEqual(json.tiers[0].sort(), ['P-pass', 'Q-lean']);
  // P equals R on primitives and bytes and is better on trials: P ranks above R.
  assert.deepEqual(json.beats['P-pass'], ['R-untried']);
  assert.deepEqual(json.tiers[1], ['R-untried']);
  // Every qualified lane has a value on every trade-off, in JSON and in the Markdown row.
  for (const id of json.qualified) {
    assert.deepEqual(Object.keys(json.table[id]).sort(), ['primitives', 'promptBytes', 'trials']);
    const row = md.split('\n').find((l) => l.startsWith(`| ${id} |`) && l.includes('passed of'));
    assert.ok(row, `row for ${id}`);
    assert.equal(row.split('|').length - 2, 5, `row for ${id} has lane, three trade-offs and ranks-above`);
  }
  assert.match(md, /primitives \(lower is better\) \| promptBytes \(lower is better\) \| trials \(higher is better\)/);
  // No composite score anywhere in the result.
  assert.doesNotMatch(JSON.stringify(json), /composite|total|weightedScore/i);
});

test('no-single-count: dominance needs every trade-off; a missing value on one blocks a rank', () => {
  const config = readJson(path.join(toy, 'config.json'));
  const judge = readJson(path.join(toy, 'judge.json'));
  // A better than B on primitives and bytes, worse on trials -> no rank. Equal everywhere -> no rank.
  const mk = (bP, bB) => ({
    config: { ...config, lanes: config.lanes.filter((l) => ['P-pass', 'R-untried'].includes(l.id)) },
    judge: { scores: judge.scores.filter((e) => ['P', 'R'].includes(e.lane)) },
    scores: { lanes: { 'P-pass': { measures: { promptInEngine: { bytes: bP } } }, 'R-untried': { measures: { promptInEngine: { bytes: bB } } } } }
  });
  let r = score(mk(100, 100));
  assert.deepEqual(r.beats, { 'P-pass': ['R-untried'], 'R-untried': [] }); // better on trials only, equal elsewhere
  r = score(mk(150, 100));
  assert.deepEqual(r.beats, { 'P-pass': [], 'R-untried': [] }); // P better on trials, R better on bytes
  assert.equal(r.tiers.length, 1);
  const noMeasure = mk(100, 100);
  delete noMeasure.scores.lanes['R-untried'];
  r = score(noMeasure);
  assert.deepEqual(r.beats, { 'P-pass': [], 'R-untried': [] }); // R not measured: P cannot be shown better on all
  assert.equal(r.table['R-untried'].promptBytes.text, 'not measured');
});

test('score.mjs refuses a config with no floors', () => {
  const dir = tmp();
  for (const f of ['config.json', 'judge.json', 'scores.json', 'pack.md']) fs.copyFileSync(path.join(toy, f), path.join(dir, f));
  const c = readJson(path.join(dir, 'config.json'));
  delete c.scoring.floors;
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(c));
  const r = spawnSync(process.execPath, [scoreCli, dir], { cwd: repo, encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /refused: .*floors/);
});
}
