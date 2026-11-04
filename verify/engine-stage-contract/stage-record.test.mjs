// Verifier's test for Expect line stage-record (plan item engine-stage-contract). Runs stage-record.mjs, the
// verifier's own checker (it does not call the engine's renderer), over the adopt trial's journal and over every run
// folder the tourney scenario tests leave behind, and shows the checker catches a broken record.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkRoot } from './stage-record.mjs';

const REPO = new URL('../../', import.meta.url).pathname;
const TRIAL = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

test('stage-record: every model run in the adopt trial has a stage.json that reassembles to brief.md, every source resolving', () => {
  const r = checkRoot(TRIAL);
  assert.equal(r.model, 3, 'brief, build and verify');
  assert.deepEqual(r.problems, []);
});

test('stage-record: every model run folder the scenario tests write has a stage.json that reassembles and resolves', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'verify-esc-'));
  const tests = readdirSync(join(REPO, 'packages/engine/test/tourney')).filter((f) => f.endsWith('.test.js')).map((f) => join('packages/engine/test/tourney', f));
  // A child of node --test inherits NODE_TEST_CONTEXT and would report to this runner instead of running; drop it.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  execFileSync(process.execPath, ['--test', ...tests], { cwd: REPO, env: { ...env, TMPDIR: tmp }, stdio: 'pipe' });
  let runs = 0;
  const problems = [];
  for (const d of readdirSync(tmp)) {
    const r = checkRoot(join(tmp, d));
    runs += r.model;
    problems.push(...r.problems);
  }
  assert.ok(runs >= 200, `scenario model runs found: ${runs}`);
  assert.deepEqual(problems.slice(0, 10), []);
});

test('stage-record: the checker catches an edited brief.md, a moved source pointer and a changed rule', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'verify-esc-bad-'));
  cpSync(TRIAL, tmp, { recursive: true });
  const run = join(tmp, 'items/trial/runs/1.build');
  writeFileSync(join(run, 'brief.md'), readFileSync(join(run, 'brief.md'), 'utf8').replace('You are the builder.', 'You are a builder.'));
  const st = JSON.parse(readFileSync(join(tmp, 'items/trial/runs/3.verify/stage.json'), 'utf8'));
  st.prompt.parts.rules[3].source.workflow = st.prompt.parts.rules[3].source.workflow.replace(/\d+$/, '0');
  st.prompt.parts.inputs[0].source.meaningAt = '/meta/actors/verify/inputs/nope';
  writeFileSync(join(tmp, 'items/trial/runs/3.verify/stage.json'), JSON.stringify(st));
  const r = checkRoot(tmp);
  assert.ok(r.problems.some((p) => p.includes('1.build') && p.includes('do not reassemble')), r.problems.join('\n'));
  assert.ok(r.problems.some((p) => p.includes('1.build') && p.includes('hash')), r.problems.join('\n'));
  assert.ok(r.problems.some((p) => p.includes('3.verify') && p.includes('rules[3]')), r.problems.join('\n'));
  assert.ok(r.problems.some((p) => p.includes('3.verify') && p.includes('does not resolve')), r.problems.join('\n'));
});
