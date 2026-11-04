// Verifier's re-score of 2026-11-04-stage-contract round 2 (Expect line rescore), from the verifier's own judge file
// (rescore/judge-round2.json, written from result2.md) and the round-2 measure files (rescore/scores-round2.json,
// copied from /mnt/project-files/stage-contract-tournament/<lane>/measure2.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const folder = path.join(repo, 'tournaments/2026-11-04-stage-contract');
const judge = path.join(here, 'rescore/judge-round2.json');
const scores = path.join(here, 'rescore/scores-round2.json');
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

test("rescore: the folder's own scores.json agrees with the round-2 measure files on promptInEngine", () => {
  const mine = readJson(scores);
  const theirs = readJson(path.join(folder, 'scores.json'));
  for (const id of ['A-control', 'S-six-parts', 'M-minimal']) {
    assert.equal(theirs.lanes[id].measures.promptInEngine.bytes, mine.lanes[id].measures.promptInEngine.bytes, id);
    assert.equal(theirs.lanes[id].sha, mine.lanes[id].sha, id);
  }
  // And re-scoring from the folder's scores.json gives the same qualified set and ranking.
  const { r } = rescore(path.join(folder, 'scores.json'));
  assert.deepEqual(r.qualified, ['S-six-parts', 'M-minimal']);
  assert.deepEqual(r.beats['S-six-parts'], ['M-minimal']);
});
