// Verifier's tests for plan item tournament-scoring-floors: Expect lines floors, primitive-rule, no-single-count.
// Written from the item head and score.mjs's interface, without reading the builder's tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const toy = path.join(here, 'toy/2026-11-04-recipe-cards');
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
