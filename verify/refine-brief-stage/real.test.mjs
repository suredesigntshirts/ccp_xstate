// Expect "real": the verifier's own case (evidence/real-case.json, a seed repo with a planted trap: proof 4 names
// `node --test test/*.spec.js`, which matches no file and passes vacuously) was run 3 times on the branch's brief
// stage with a real model through scripts/bench/run.mjs (evidence/real-runs.json, pinned quick-fix cb8645f4, the
// variant-combined pin). This test re-checks those results and runs every command the briefs give in the seed repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { builderCriteria, oneCheckPerLine } from '../../scripts/bench/stages.mjs';
import { REPO, readJson } from './lib.mjs';

const c = readJson(join(REPO, 'verify/refine-brief-stage/evidence/real-case.json'));
const runs = readJson(join(REPO, 'verify/refine-brief-stage/evidence/real-runs.json'));
const expect = c.input.issue.expect;
// A child node --test run under this test runner reports to it unless its context variable is dropped.
const CLEAN = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT'));

test('all 3 runs pinned the combined workflow and returned', () => {
  for (const r of Object.values(runs)) {
    assert.equal(r.bench.workflow.sha256, readJson(join(REPO, 'bench/brief/runs/variant-combined/set.json')).workflow.sha256);
    assert.equal(r.bench.model, 'claude-opus-5-5');
    assert.ok(r.result.builder && r.result.verifier);
  }
});

test('verifier briefs: one check per line, and check 4 rests on npm test, never on the proof\'s spec glob', () => {
  for (const [k, r] of Object.entries(runs)) {
    assert.equal(oneCheckPerLine(r.result, expect).met, true, `run ${k}`);
    const check4 = r.result.verifier.split(/\nCheck 5\./)[0].split(/Check 4\./)[1];
    assert.match(check4, /npm test/);
    assert.doesNotMatch(check4, /test\/\*\.spec\.js/, `run ${k}`);
  }
});

test('builder briefs carry no PASS or FAIL condition', () => {
  for (const [k, r] of Object.entries(runs)) assert.doesNotMatch(r.result.builder, /\b(PASS|FAIL)\b/, `run ${k}`);
});

test('builder briefs quoting every expect line: runs 1 and 2 do, run 3 restates them (the accepted builder-criteria trade)', () => {
  assert.deepEqual(Object.entries(runs).map(([k, r]) => [k, builderCriteria(r.result, expect).met]), [['1', true], ['2', true], ['3', false]]);
});

// Every command the six briefs give, as written (Advisory included). At the case commit f2c does not exist yet, so
// those commands are expected to fail with `unknown command: f2c`; each must still run (no shell or syntax error).
const COMMANDS = [
  ['node bin/units.js f2c 212 | od -c', /unknown command: f2c/],
  ['node bin/units.js f2c 98.6 | od -c', /unknown command: f2c/],
  ['node bin/units.js c2f 100 | od -c', /2\s+1\s+2\s+\\n/],
  ['npm test; echo "exit=$?"', /exit=0/],
  ['cat README.md', /## c2f/],
  ['npm install', /up to date|added/],
  ['node --test', /# pass 1/],
  ['node --test test/*.spec.js', /# tests 0/],
  ['node bin/units.js k2c 1; echo $?', /unknown command: k2c\s+2/],
  ['node bin/units.js foo 1; echo $?', /unknown command: foo\s+2/],
  ['node bin/units.js f2c 212', /unknown command: f2c/],
  ['node bin/units.js f2c 98.6', /unknown command: f2c/],
  ['node bin/units.js c2f 100', /^212$/m],
  ['npm test', /# pass 1/]
];

test('every command the briefs give runs as written in the seed repo at the case commit', () => {
  const repo = join(mkdtempSync(join(tmpdir(), 'v-rbs-real-')), 'repo');
  for (const [f, text] of Object.entries(c.repo.files)) { mkdirSync(dirname(join(repo, f)), { recursive: true }); writeFileSync(join(repo, f), text); }
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  execFileSync('git', ['-C', repo, '-c', 'user.email=v@example.com', '-c', 'user.name=v', 'add', '-A']);
  execFileSync('git', ['-C', repo, '-c', 'user.email=v@example.com', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', 'commit', '-q', '-m', 'seed']);
  const all = Object.values(runs).map((r) => `${r.result.builder}\n${r.result.verifier}`).join('\n');
  for (const [cmd, want] of COMMANDS) {
    assert.ok(all.includes(cmd.split(';')[0]), `not in any brief: ${cmd}`);
    let out;
    try { out = execFileSync('bash', ['-c', `( ${cmd} ) 2>&1`], { cwd: repo, encoding: 'utf8', env: CLEAN }); } catch (e) { out = `${e.stdout}`; }
    assert.doesNotMatch(out, /syntax error|SyntaxError|command not found|Missing script/, cmd);
    assert.match(out, want, cmd);
  }
});
