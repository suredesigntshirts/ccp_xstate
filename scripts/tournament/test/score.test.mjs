// Builder tests for floors-first scoring (plan item tournament-scoring-floors): args.mjs refuses a scoring block
// without floors or with one trade-off, and score.mjs qualifies on floors, counts primitives by the rule, and ranks
// qualified lanes only by dominance over every trade-off. A toy subject, so the kit stays subject-free.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildArgs, checkScoring, ConfigError } from '../args.mjs';
import { countPrimitives, score, scoreFolder } from '../score.mjs';

const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA = 'b'.repeat(40);

const scoring = () => ({
  floors: { scenarios: ['s1', 's2'], contractTests: [{ id: 'c1', what: 'names carry meaning' }], constraints: ['no-deps'] },
  tradeoffs: [
    { id: 'primitives', kind: 'primitives' },
    { id: 'bytes', kind: 'measure', measure: 'size.bytes', better: 'lower' },
    { id: 'trials', kind: 'trials' }
  ]
});
const config = () => ({
  id: 'toy-recipes',
  question: 'How should a recipe book be laid out?',
  base: { repo: 'example/toy', sha: SHA },
  runner: { sha: SHA },
  scoring: scoring(),
  lanes: ['good', 'lean', 'noscenario', 'nocontract', 'noconstraint'].map((id, i) => ({ id, alias: 'ABCDE'[i], stance: id })),
  stages: [
    { id: 'design', role: 'designer', over: 'each' },
    { id: 'judge', role: 'judge', over: 'all' }
  ]
});

const STAGES = ['soups/write', 'soups/check', 'cakes/write', 'cakes/check'];
const passAll = (fail = {}) =>
  [
    ['scenarios', 's1'],
    ['scenarios', 's2'],
    ['contractTests', 'c1'],
    ['constraints', 'no-deps']
  ].map(([kind, id]) => ({ kind, id, pass: fail[id] === undefined, evidence: fail[id] ?? 'reran' }));
const prims = (n) => [
  ...Array.from({ length: n }, (_, i) => ({ name: `general${i}`, stages: STAGES })),
  { name: 'onlyWrite', stages: ['soups/write', 'cakes/write'] },
  { name: 'onlySoups', stages: ['soups/write', 'soups/check'] },
  { name: 'heavy', weight: 2, stages: STAGES }
];
const judge = () => ({
  scores: [
    { lane: 'A', floors: passAll(), modelStages: STAGES, primitives: prims(5), trials: [{ ref: 't1', passed: true, outcome: 'merged' }], notes: '' },
    { lane: 'B', floors: passAll(), modelStages: STAGES, primitives: prims(2), trials: [], notes: '' },
    { lane: 'C', floors: passAll({ s2: 'fails on an empty book' }), modelStages: STAGES, primitives: prims(0), notes: '' },
    { lane: 'D', floors: passAll().filter((f) => f.id !== 'c1'), modelStages: STAGES, primitives: prims(0), notes: '' },
    { lane: 'E', floors: passAll({ 'no-deps': 'adds a dependency' }), modelStages: STAGES, primitives: prims(0), notes: '' }
  ],
  ranking: [],
  bestIdeas: []
});
const scores = () => ({ lanes: { good: { measures: { size: { bytes: 900 } } }, lean: { measures: { size: { bytes: 1000 } } } } });

function folder(c, files = {}) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'score-')), c.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(c));
  fs.writeFileSync(path.join(dir, 'pack.md'), '# Toy pack\n');
  for (const [f, v] of Object.entries(files)) fs.writeFileSync(path.join(dir, f), typeof v === 'string' ? v : JSON.stringify(v));
  return dir;
}

test('args.mjs refuses scoring with no floors, a free-text rule alone, or a single trade-off', () => {
  assert.doesNotThrow(() => buildArgs(folder(config())));
  const cases = {
    'no floors': (s) => delete s.floors,
    'rule only': (s) => {
      for (const k of Object.keys(s)) delete s[k];
      s.rule = 'fewest primitives wins';
    },
    'empty floors': (s) => (s.floors = { scenarios: [], contractTests: [], constraints: [] }),
    'unknown floor kind': (s) => (s.floors.vibes = ['x']),
    'one trade-off': (s) => (s.tradeoffs = [s.tradeoffs[0]]),
    'measure without path': (s) => delete s.tradeoffs[1].measure,
    'unknown trade-off kind': (s) => (s.tradeoffs[2].kind = 'weighted-sum'),
    'duplicate floor': (s) => s.floors.scenarios.push('s1')
  };
  for (const [name, fn] of Object.entries(cases)) {
    const c = config();
    fn(c.scoring);
    assert.throws(() => buildArgs(folder(c)), ConfigError, name);
  }
  const c = config();
  delete c.scoring.floors;
  const r = spawnSync(process.execPath, [path.join(KIT, 'args.mjs'), folder(c)], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /config\.scoring\.floors is required/);
});

test('the kit prompts read the scoring as text, and a prompt naming a scoring field that is gone is refused', () => {
  const a = buildArgs(folder(config()));
  assert.match(a.scoring.text, /scenarios s2/);
  assert.match(a.scoring.text, /contractTests c1: names carry meaning/);
  assert.match(a.scoring.text, /no single one decides/);
  assert.ok(a.roles.judge.prompt.includes('{{scoring.text}}'));
  const dir = folder(config());
  fs.mkdirSync(path.join(dir, 'prompts'));
  fs.writeFileSync(path.join(dir, 'prompts/judge.md'), 'Rule: {{scoring.rule}}');
  assert.throws(() => buildArgs(dir), /scoring has no value for it/);
});

test('a lane failing any floor is not qualified, with the floor named, whatever its primitive count', () => {
  const r = score({ config: config(), scores: scores(), judge: judge() });
  assert.deepEqual(r.qualified, ['good', 'lean']);
  assert.deepEqual(r.notQualified, ['noscenario', 'nocontract', 'noconstraint']);
  assert.deepEqual(r.floors.noscenario.failed, [{ kind: 'scenarios', id: 's2', why: 'fails on an empty book' }]);
  assert.deepEqual(r.floors.nocontract.failed, [{ kind: 'contractTests', id: 'c1', why: 'not reported by the judge' }]);
  assert.deepEqual(r.floors.noconstraint.failed, [{ kind: 'constraints', id: 'no-deps', why: 'adds a dependency' }]);
  assert.equal(r.table.noscenario, undefined, 'the trade-off table holds qualified lanes only');
});

test('a primitive counts only if every model stage uses it in more than one workflow; the rest are special cases', () => {
  const p = countPrimitives(prims(1), STAGES);
  assert.deepEqual(p.counted.map((x) => x.name), ['general0', 'heavy']);
  assert.equal(p.count, 2);
  assert.equal(p.weighted, 3);
  assert.deepEqual(
    p.special.map((x) => [x.name, x.why]),
    [
      ['onlyWrite', 'used by 2 of 4 model stages (not soups/check, cakes/check)'],
      ['onlySoups', 'used by 2 of 4 model stages (not cakes/write, cakes/check); used in one workflow (soups)']
    ]
  );
  const one = countPrimitives([{ name: 'x', stages: ['soups/write', 'soups/check'] }], ['soups/write', 'soups/check']);
  assert.equal(one.count, 0);
  assert.match(one.special[0].why, /^used in one workflow \(soups\)$/);
  assert.match(countPrimitives([{ name: 'y', stages: [] }], []).special[0].why, /no model stages/);
});

test('qualified lanes rank only by dominance over every trade-off, never by one count', () => {
  const r = score({ config: config(), scores: scores(), judge: judge() });
  // good: 7 weighted, 900 bytes, 1 trial; lean: 4 weighted, 1000 bytes, 0 trials. Neither dominates.
  assert.equal(r.table.good.primitives.value, 7);
  assert.equal(r.table.lean.primitives.value, 4);
  assert.deepEqual(r.beats, { good: [], lean: [] });
  assert.deepEqual(r.tiers, [['good', 'lean']]);
  // Make lean worse on bytes and trials too: now good is no better on primitives, so still no ranking from it alone.
  const j = judge();
  j.scores[1].trials = [{ ref: 't', passed: true, outcome: 'merged' }];
  const s = scores();
  s.lanes.lean.measures.size.bytes = 900;
  const r2 = score({ config: config(), scores: s, judge: j });
  assert.deepEqual(r2.beats, { good: [], lean: ['good'] }, 'lean is no worse on any trade-off and better on primitives');
  assert.deepEqual(r2.tiers, [['lean'], ['good']]);
  // A missing measure makes two lanes incomparable on it, so neither ranks above the other.
  delete s.lanes.good.measures.size;
  assert.deepEqual(score({ config: config(), scores: s, judge: j }).beats, { good: [], lean: [] });
});

test('score.mjs writes scoring.json and scoring.md for a folder, and refuses a judge naming an unknown lane', () => {
  const dir = folder(config(), { 'judge.json': judge(), 'scores.json': scores() });
  const r = spawnSync(process.execPath, [path.join(KIT, 'score.mjs'), dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /\| noscenario \| no \| scenarios s2: fails on an empty book \|/);
  assert.match(r.stdout, /\| good \| 6 counted \(7 weighted\), 2 special \| 900 \| 1 passed of 1 \| none \|/);
  assert.match(r.stdout, /- onlySoups: used by 2 of 4 model stages/);
  const json = JSON.parse(fs.readFileSync(path.join(dir, 'scoring.json'), 'utf8'));
  assert.deepEqual(json.qualified, ['good', 'lean']);
  const bad = judge();
  bad.scores[0].lane = 'Z';
  assert.throws(() => scoreFolder(folder(config(), { 'judge.json': bad })), /lane Z/);
});

test('checkScoring accepts measure trade-offs only with a direction', () => {
  const s = scoring();
  delete s.tradeoffs[1].better;
  assert.throws(() => checkScoring(s), /better must be/);
});
