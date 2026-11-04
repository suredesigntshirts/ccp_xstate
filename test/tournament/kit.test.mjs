// Builder tests for the tournament kit (plan item tournament-kit): args.mjs builds and refuses, the runner runs with
// stub agents, measure.mjs runs a suite and a measure, and scripts/tournament/ stays subject-free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildArgs, ConfigError } from '../../scripts/tournament/args.mjs';
import { dryRun } from '../../scripts/tournament/dry-run.mjs';
import { measureLane, parseTap, summary } from '../../scripts/tournament/measure.mjs';
import { tally } from '../../tournaments/2026-11-03-context/measure.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KIT = path.join(ROOT, 'scripts/tournament');
const SHA = 'a'.repeat(40);

function folder(id, config, files = {}) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tourney-')), id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(config));
  fs.writeFileSync(path.join(dir, 'pack.md'), '# Toy pack\n');
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  return dir;
}

const toy = () => ({
  id: 'toy-naming',
  question: 'How should test files be named?',
  base: { repo: 'example/toy', sha: SHA },
  runner: { sha: SHA },
  scoring: { rule: 'clarity per word' },
  lanes: [
    { id: 'short', alias: 'A', stance: 'short names' },
    { id: 'long', alias: 'B', stance: 'descriptive names' }
  ],
  stages: [
    { id: 'design', role: 'designer', over: 'each' },
    { id: 'judge', role: 'judge', over: 'all' }
  ]
});

test('the first tournament builds args with every stage role resolved', () => {
  const a = buildArgs(path.join(ROOT, 'tournaments/2026-11-03-context'));
  assert.deepEqual(a.stages.map((s) => s.id), ['design', 'build', 'judge', 'delete', 'final']);
  assert.deepEqual(Object.keys(a.roles).sort(), ['designer', 'executor', 'final-judge', 'judge']);
  assert.ok(a.roles.executor.schema.properties.scenarios, 'the tournament schema overrides the kit schema');
  assert.match(a.pack, /frozen 2026-11-03/);
});

test('args.mjs refuses a config missing each pinned field', () => {
  const drop = {
    id: (c) => delete c.id,
    question: (c) => delete c.question,
    'base.repo': (c) => delete c.base.repo,
    'base.sha': (c) => delete c.base.sha,
    runner: (c) => delete c.runner,
    'runner.sha': (c) => delete c.runner.sha,
    lanes: (c) => delete c.lanes,
    'lanes empty': (c) => (c.lanes = []),
    stages: (c) => delete c.stages,
    scoring: (c) => delete c.scoring,
    'scoring.rule': (c) => delete c.scoring.rule
  };
  assert.doesNotThrow(() => buildArgs(folder('toy-naming', toy())));
  for (const [name, fn] of Object.entries(drop)) {
    const c = toy();
    fn(c);
    assert.throws(() => buildArgs(folder('toy-naming', c)), ConfigError, `missing ${name} must be refused`);
  }
});

test('args.mjs refuses a prompt naming a value the runner never fills', () => {
  const dir = folder('toy-naming', toy(), { 'prompts/judge.md': 'Judge {{lane.id}}' });
  assert.throws(() => buildArgs(dir), /runs once over all lanes/);
  const c = toy();
  delete c.lanes[1].stance;
  assert.throws(() => buildArgs(folder('toy-naming', c)), /lane long has no value for it/);
});

test('the CLI exits 1 with the reason on a refused folder', () => {
  const c = toy();
  delete c.runner.sha;
  const r = spawnSync(process.execPath, [path.join(KIT, 'args.mjs'), folder('toy-naming', c)], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /config\.runner\.sha is required/);
});

test('a design-and-judge toy runs through the runner with stub agents', async () => {
  const args = buildArgs(folder('toy-naming', toy()));
  const { result, calls } = await dryRun(args, {
    agent: async (prompt, opts) =>
      opts.label === 'judge'
        ? { scores: [], ranking: prompt.includes('Lane B') ? ['B', 'A'] : [], bestIdeas: [] }
        : { designFile: `${opts.label}.md`, summary: prompt.includes('descriptive') ? 'long' : 'short' }
  });
  assert.deepEqual(calls.map((c) => c.label), ['design:short', 'design:long', 'judge']);
  assert.ok(calls.every((c) => !c.prompt.includes('{{')), 'every placeholder filled');
  assert.deepEqual(result.result.ranking, ['B', 'A']);
  assert.equal(result.lanes.long.design.summary, 'long');
});

test('a pick stage runs only the ranked lanes, and a lane whose agent dies stops', async () => {
  const c = toy();
  c.lanes.push({ id: 'third', alias: 'C', stance: 'numbered' });
  c.stages.push({ id: 'revise', role: 'designer', over: 'each', pick: { from: 'judge', top: 1, plus: ['third'] } });
  const { result, calls, logs } = await dryRun(buildArgs(folder('toy-naming', c)), {
    agent: async (_p, opts) =>
      opts.label === 'judge' ? { scores: [], ranking: ['B', 'A', 'C'], bestIdeas: [] } : opts.label === 'design:short' ? null : { designFile: 'x', summary: 's' }
  });
  assert.deepEqual(calls.filter((x) => x.label.startsWith('revise')).map((x) => x.label), ['revise:long', 'revise:third']);
  assert.deepEqual(result.stopped, ['short']);
  assert.ok(logs.some((l) => /not run for short/.test(l)));
});

test('measure.mjs runs the suite and the measure in a checkout', async () => {
  const c = { ...toy(), suite: { command: [process.execPath, '--test', '--test-reporter=tap', 't/*.test.mjs'] }, measure: 'm.mjs' };
  const dir = folder('toy-naming', c, { 'm.mjs': 'export function measure({ checkout }) { return { files: 1, at: checkout.length > 0 }; }' });
  const lane = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-'));
  fs.mkdirSync(path.join(lane, 't'));
  fs.writeFileSync(path.join(lane, 't/a.test.mjs'), "import {test} from 'node:test'; test('one', () => {}); test('two', () => { throw new Error('no') });");
  const r = await measureLane({ tournament: dir, lane: 'short', checkout: lane });
  assert.equal(r.suite.tests, 2);
  assert.equal(r.suite.pass, 1);
  assert.equal(r.suite.fail, 1);
  assert.deepEqual(r.suite.failing, ['two']);
  assert.deepEqual(r.measures, { files: 1, at: true });
  assert.match(summary(r), /\| 2 \| 1 \| 1 \|/);
  await assert.rejects(measureLane({ tournament: dir, lane: 'nobody', checkout: lane }), ConfigError);
});

test('parseTap reads the summary lines', () => {
  assert.deepEqual(parseTap('ok 1 - a\nnot ok 2 - b # x\n# tests 2\n# pass 1\n# fail 1\n'), {
    tests: 2, pass: 1, fail: 1, skipped: null, todo: null, failing: ['b']
  });
});

test('the context measure tallies a chart', () => {
  const t = tally({
    w: {
      meta: { guards: { g: ['context.a', { path: 'context.b', is: 1 }] }, events: { ping: {} } },
      states: {
        a: { invoke: { src: 'x', onDone: { target: 'b', actions: [{ type: 'set', params: {} }] } }, after: { t: { target: 'b' } } },
        b: { type: 'final', on: { ping: { target: 'a', reenter: true } } }
      }
    }
  });
  assert.deepEqual(t.stateKinds, { normal: 1, final: 1 });
  assert.deepEqual(t.transitionKinds, { 'invoke.onDone': 1, after: 1, on: 1, reenter: 1 });
  assert.deepEqual(t.guardForms, { present: 1, is: 1 });
  assert.deepEqual(t.effects, { run: 1, stop: 1, timer: 1, cancel: 1 });
  assert.deepEqual(t.ops, { set: 1 });
  assert.equal(t.events.ping, 2);
});

test('scripts/tournament names no tournament, lane, workflow or engine path', () => {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'tournaments/2026-11-03-context/config.json'), 'utf8'));
  const banned = [config.id, ...config.lanes.map((l) => l.id), 'quick-fix', 'feature.json', 'research.json', 'packages/', 'workflows/', 'engine', 'xstate'];
  const files = fs.readdirSync(KIT, { recursive: true }).filter((f) => fs.statSync(path.join(KIT, f)).isFile());
  for (const f of files) {
    const text = fs.readFileSync(path.join(KIT, f), 'utf8').toLowerCase().replaceAll('.github/workflows/', '.github/');
    for (const b of banned) assert.ok(!text.includes(b.toLowerCase()), `${f} names ${b}`);
  }
});
