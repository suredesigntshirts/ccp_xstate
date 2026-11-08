// Expect: refine-brief-stage/rubric, refine-brief-stage/cases, refine-brief-stage/variants, refine-brief-stage/real
// The brief stage's bench: the mechanical criteria score planted and recorded briefs as graded, the committed run
// sets rescore with --no-judge to the decision's totals, and the intake-shaped cases fit intake's schema with their
// traps really in their seed repos. Planted and recorded briefs are input under fixtures/brief-bench/.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { check } from '../../../packages/engine/src/index.js';
import { caseRepo, casesOf } from '../../../scripts/bench/lib.mjs';
import { builderCriteria, oneCheckPerLine } from '../../../scripts/bench/stages.mjs';

// Helpers for the tests below.
const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const RUNS = join(REPO, 'bench/brief/runs');
const SETS = ['baseline', 'variant-dry-run', 'variant-proof-at-head', 'variant-words-test', 'variant-criteria-not-methods', 'variant-dry-run-copy', 'variant-combined'];
const NEW_CASES = ['intake-shared-parser', 'intake-suggested-fix'];
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** The run folders of a set (each has bench.json). */
const runsOf = (dir) => readdirSync(dir).filter((r) => existsSync(join(dir, r, 'bench.json'))).sort();

/** Copy a committed run set to a temp folder and rescore it there with --no-judge (kept verdicts only, no model). */
function rescore(set) {
  const dir = join(mkdtempSync(join(tmpdir(), 'v-rbs-')), set);
  cpSync(join(RUNS, set), dir, { recursive: true });
  execFileSync(process.execPath, [join(REPO, 'scripts/bench/score.mjs'), '--stage', 'brief', '--runs', dir, '--no-judge'], { cwd: REPO, stdio: 'ignore' });
  return dir;
}

/** Runs met per criterion in a scored set. */
function totals(dir) {
  const t = {};
  for (const r of runsOf(dir)) for (const [k, v] of Object.entries(readJson(join(dir, r, 'score.json')).criteria)) t[k] = (t[k] ?? 0) + (v.met === true ? 1 : 0);
  return t;
}

{
const rubric = readJson(join(REPO, 'bench/brief/rubric.json'));
const caseOf = (id) => readJson(join(REPO, 'bench/brief/cases', id, 'case.json'));

for (const id of ['verifier-methods-copied', 'verifier-paraphrased']) {
  test(`builder-criteria on the verifier's own planted brief ${id}`, () => {
    const e = readJson(join(REPO, 'test/regression/fixtures/brief-bench', `${id}.json`));
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
}

{
const schemas = readJson(join(REPO, 'workflows/intake.json')).meta.schemas;

for (const id of NEW_CASES) {
  test(`${id}: issue fits intake's #shaped schema, with url, and has must_catch and must_not`, () => {
    const c = readJson(join(REPO, 'bench/brief/cases', id, 'case.json'));
    const { url, ...shaped } = c.input.issue;
    assert.deepEqual(check({ $ref: '#shaped' }, shaped, schemas), []);
    assert.match(url, /^https:\/\//);
    for (const k of ['proofs', 'non_goals', 'assumptions']) assert.ok(c.input.issue[k].length > 0, k);
    assert.ok(c.must_catch.length && c.must_not.length);
    // the check is not vacuous: the same issue without proofs fails it
    const { proofs, ...noProofs } = shaped;
    assert.notDeepEqual(check({ $ref: '#shaped' }, noProofs, schemas), []);
  });
}

const repoOf = (id) => caseRepo(casesOf('brief', id)[0], mkdtempSync(join(tmpdir(), `v-rbs-${id}-`)));
const sh = (cwd, cmd) => { try { return { code: 0, out: execFileSync('bash', ['-c', cmd], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) }; } catch (e) { return { code: e.status, out: `${e.stdout}${e.stderr}` }; } };

test('intake-shared-parser trap: proof 6 names npm run test:cli, which the repo lacks; parse() is shared with CSV', () => {
  const repo = repoOf('intake-shared-parser');
  assert.equal(readJson(join(repo, 'package.json')).scripts['test:cli'], undefined);
  assert.notEqual(sh(repo, 'npm run test:cli').code, 0);
  assert.equal(sh(repo, 'npm test').code, 0);
  assert.match(readFileSync(join(repo, 'src/parse.js'), 'utf8'), /export function parse\(text, sep = ','\)/);
  assert.match(readFileSync(join(repo, 'test/csv.test.js'), 'utf8'), /parse\(/);
});

test('intake-suggested-fix trap: the test asserts SyntaxError, and Node already gives line 3 column 3', () => {
  const repo = repoOf('intake-suggested-fix');
  assert.match(readFileSync(join(repo, 'test/config.test.js'), 'utf8'), /assert\.throws\([^)]*\)\),?\s*SyntaxError\)|SyntaxError\)/);
  const d = mkdtempSync(join(tmpdir(), 'v-rbs-cfg-'));
  writeFileSync(join(d, 'c.json'), '{\n  "port": 9000,\n  greeting: "x"\n}\n');
  const r = sh(repo, `node src/app.js ${d}/c.json`);
  assert.equal(r.code, 1);
  assert.match(r.out, /line 3 column 3/);
});

}

{
// The decision's "After the build" table: runs met of 27, in the order of ROWS.
const ROWS = ['one-check-per-line', 'no-restated-rules', 'builder-criteria', 'words-only', 'runs-as-written', 'catches-traps', 'avoids-must-not', 'methods-private'];
const TABLE = {
  baseline: [27, 27, 18, 10, 19, 20, 18, 11],
  'variant-dry-run': [27, 26, 20, 8, 22, 23, 17, 7],
  'variant-proof-at-head': [27, 27, 12, 10, 20, 22, 17, 12],
  'variant-words-test': [27, 27, 19, 19, 22, 20, 24, 11],
  'variant-criteria-not-methods': [23, 26, 27, 12, 16, 18, 15, 11],
  'variant-dry-run-copy': [26, 26, 20, 8, 23, 21, 16, 10],
  'variant-combined': [27, 27, 12, 20, 23, 20, 24, 11]
};

const rescored = {};
for (const set of SETS) {
  test(`${set}: rescored with --no-judge matches the decision's table`, () => {
    rescored[set] = rescore(set);
    const t = totals(rescored[set]);
    assert.equal(t.returned, 27);
    assert.equal(t['changes-nothing'], 27);
    assert.deepEqual(ROWS.map((r) => t[r]), TABLE[set]);
  });
}

}

{
const c = readJson(join(REPO, 'test/regression/fixtures/brief-bench/real-case.json'));
const runs = readJson(join(REPO, 'test/regression/fixtures/brief-bench/real-runs.json'));
const expect = c.input.issue.expect;

test('verifier briefs: one check per line, and check 4 rests on npm test, never on the proof\'s spec glob', () => {
  for (const [k, r] of Object.entries(runs)) {
    assert.equal(oneCheckPerLine(r.result, expect).met, true, `run ${k}`);
    const check4 = r.result.verifier.split(/\nCheck 5\./)[0].split(/Check 4\./)[1];
    assert.match(check4, /npm test/);
    assert.doesNotMatch(check4, /test\/\*\.spec\.js/, `run ${k}`);
  }
});

test('builder briefs quoting every expect line: runs 1 and 2 do, run 3 restates them (the accepted builder-criteria trade)', () => {
  assert.deepEqual(Object.entries(runs).map(([k, r]) => [k, builderCriteria(r.result, expect).met]), [['1', true], ['2', true], ['3', false]]);
});

}
