// Expect "rubric": the two new criteria, the mechanical one on briefs the verifier wrote, and the baseline rescored.
// The judged half (score.mjs --judge-check, with this folder's evidence/*.json as --extra) needs a model; its output
// is kept in evidence/judge-check.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { builderCriteria } from '../../scripts/bench/stages.mjs';
import { REPO, readJson, rescore, totals } from './lib.mjs';

const rubric = readJson(join(REPO, 'bench/brief/rubric.json'));
const caseOf = (id) => readJson(join(REPO, 'bench/brief/cases', id, 'case.json'));

test('rubric has builder-criteria (mechanical) and methods-private (judged), approved with a record', () => {
  const by = Object.fromEntries(rubric.criteria.map((c) => [c.id, c.by]));
  assert.equal(by['builder-criteria'], 'mechanical');
  assert.equal(by['methods-private'], 'judge');
  assert.deepEqual(rubric.approved.added.criteria, ['builder-criteria', 'methods-private']);
  assert.match(rubric.approved.added.record, /^plan\/decisions\/.+\.md$/);
});

test('judge check has at least 2 planted-bad outputs for methods-private', () => {
  const dir = join(REPO, 'bench/brief/judge-check');
  const planted = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => readJson(join(dir, f))).filter((e) => e.planted?.['methods-private']);
  assert.ok(planted.length >= 2, `only ${planted.length}`);
});

for (const id of ['verifier-methods-copied', 'verifier-paraphrased']) {
  test(`builder-criteria on the verifier's own planted brief ${id}`, () => {
    const e = readJson(join(REPO, 'verify/refine-brief-stage/evidence', `${id}.json`));
    const got = builderCriteria(e.result, caseOf(e.case).input.issue.expect);
    assert.equal(got.met, e.grades['builder-criteria'], got.why);
  });
}

test('builder-criteria accepts escaped double quotes and refuses a paraphrase', () => {
  const expect = ['prints "ok"', 'exits 0'];
  assert.equal(builderCriteria({ builder: 'Lines: prints \\"ok\\"; exits 0' }, expect).met, true);
  assert.equal(builderCriteria({ builder: 'Lines: prints ok; exits 0' }, expect).met, false);
});

test('baseline rescored with --no-judge: all 27 runs carry both new criteria, totals as committed', () => {
  const dir = rescore('baseline');
  const t = totals(dir);
  assert.equal(t.returned, 27);
  assert.equal(t['builder-criteria'], 18);
  assert.equal(t['methods-private'], 11);
  assert.deepEqual(
    [t['one-check-per-line'], t['no-restated-rules'], t['words-only'], t['runs-as-written'], t['catches-traps'], t['avoids-must-not']],
    [27, 27, 10, 19, 20, 18]
  );
});
