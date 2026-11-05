// Expect "cases": the intake-shaped cases fit intake's #shaped schema through the engine, their traps are really in
// their seed repos, each has 3 baseline runs, and the 7 old cases and their 21 runs' outputs are as on main.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { check } from '../../packages/engine/src/index.js';
import { caseRepo, casesOf } from '../../scripts/bench/lib.mjs';
import { NEW_CASES, OLD_CASES, REPO, RUNS, readJson, runsOf } from './lib.mjs';

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
  test(`${id}: 3 baseline runs`, () => {
    assert.deepEqual(runsOf(join(RUNS, 'baseline')).filter((r) => r.startsWith(`${id}.`)), [1, 2, 3].map((k) => `${id}.${k}`));
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

const MAIN = readJson(join(REPO, 'verify/refine-brief-stage/evidence/main-fixtures.json'));
const hash = (f) => createHash('sha256').update(readFileSync(join(REPO, f))).digest('hex');
const filesUnder = (dir) => readdirSync(join(REPO, dir), { recursive: true }).map((f) => `${dir}/${f}`).filter((f) => statSync(join(REPO, f)).isFile());

test('the 7 old cases are unchanged from main', () => {
  const now = Object.fromEntries(OLD_CASES.flatMap((c) => filesUnder(`bench/brief/cases/${c}`)).map((f) => [f, hash(f)]));
  assert.deepEqual(now, MAIN.caseFiles);
});

test('the 21 old baseline runs only gained the new criteria: files and old verdicts as on main', () => {
  const now = Object.fromEntries(runsOf(join(RUNS, 'baseline')).filter((r) => OLD_CASES.some((c) => r.startsWith(`${c}.`)))
    .flatMap((r) => filesUnder(`bench/brief/runs/baseline/${r}`)).filter((f) => !f.endsWith('/score.json') && !f.endsWith('/judge/methods-private.json')).map((f) => [f, hash(f)]));
  const main = Object.fromEntries(Object.entries(MAIN.baselineFiles).filter(([f]) => !f.includes('/system-prompts/')));
  assert.deepEqual(now, main);
  assert.equal(Object.keys(MAIN.baselineScores).length, 21);
  for (const [r, old] of Object.entries(MAIN.baselineScores)) {
    const crit = readJson(join(RUNS, 'baseline', r, 'score.json')).criteria;
    for (const [k, v] of Object.entries(old)) assert.deepEqual({ met: crit[k].met, why: crit[k].why }, v, `${r} ${k}`);
    assert.equal(typeof crit['builder-criteria'].met, 'boolean', `${r} builder-criteria`);
    assert.equal(typeof crit['methods-private'].met, 'boolean', `${r} methods-private`);
  }
});

test('main\'s baseline system prompts are all still there', () => {
  for (const [f, h] of Object.entries(MAIN.baselineFiles).filter(([f]) => f.includes('/system-prompts/'))) assert.equal(hash(f), h, f);
});
