// Expect same-prompt: the prompt the bench sends equals render() for the same workflow version and input, for every
// model stage of quick-fix, and for the adopt trial's brief input it equals the committed runs/0.brief/brief.md.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadWorkflow } from '../../packages/engine/src/index.js';
import { render, stagesOf } from '../../packages/engine/src/stages.js';
import { ADOPT, ADOPT_PIN, REPO, adoptBlobs, benchPrompt, readJson } from './lib.mjs';

const current = loadWorkflow('quick-fix', { dir: join(REPO, 'workflows') });
const pinned = loadWorkflow(`quick-fix@${ADOPT_PIN}`, { root: adoptBlobs(), dir: join(REPO, 'workflows') });
const mine = (spec, actor, input, run) => render({ actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run });
const RUNS = { brief: '0.brief', build: '1.build', verify: '3.verify' };

test('quick-fix has exactly the three model stages the recorded inputs cover', () => {
  assert.deepEqual(stagesOf(current).sort(), Object.keys(RUNS).sort());
});

for (const [actor, name] of Object.entries(RUNS)) {
  const runFile = join(ADOPT, 'items/trial/runs', name, 'run.json');
  const rec = readJson(runFile);
  test(`${actor}: bench --prompt-only on the recorded input equals my render(), current workflow`, () => {
    const got = benchPrompt(['--stage', actor, '--input', runFile, '--run-id', rec.run]);
    assert.equal(got, mine(current, actor, rec.input, rec.run));
  });
  test(`${actor}: bench --prompt-only on the trial's pinned blob equals my render() and the committed brief.md`, () => {
    const got = benchPrompt(['--stage', actor, '--input', runFile, '--run-id', rec.run, '--workflow', join(ADOPT, 'blobs', ADOPT_PIN)]);
    const r = mine(pinned, actor, rec.input, rec.run);
    assert.equal(got, r);
    assert.equal(got, readFileSync(join(ADOPT, 'items/trial/runs', name, 'brief.md'), 'utf8'), `${name} brief.md`);
  });
}

test('brief: bench --prompt-only for every case equals my render() of the task literal plus the case input', () => {
  const task = current.states.briefing.invoke.input.task;
  assert.equal(typeof task?.value, 'string');
  const dir = join(REPO, 'bench/brief/cases');
  for (const id of readdirSync(dir).filter((n) => existsSync(join(dir, n, 'case.json')))) {
    const c = readJson(join(dir, id, 'case.json'));
    const got = benchPrompt(['--stage', 'brief', '--case', id]);
    const run = /"run": "([^"]+)"/.exec(got)?.[1];
    assert.ok(run, `${id}: a run id in the return line`);
    const input = Object.fromEntries(Object.entries(current.states.briefing.invoke.input).map(([k, v]) => [k, v && typeof v === 'object' && 'value' in v ? v.value : (c.input[k] ?? null)]));
    assert.equal(got, mine(current, 'brief', input, run), id);
  }
});

test('every committed bench run folder sent brief.md, and brief.md is render() of its run.json', () => {
  const sets = join(REPO, 'bench/brief/runs');
  let n = 0;
  for (const set of readdirSync(sets)) for (const r of readdirSync(join(sets, set))) {
    const bf = join(sets, set, r, 'bench.json');
    if (!existsSync(bf)) continue;
    const b = readJson(bf);
    const runDir = join(sets, set, r, b.runFolder);
    const brief = readFileSync(join(runDir, 'brief.md'));
    assert.equal(createHash('sha256').update(brief).digest('hex'), b.prompt.sha256, `${set}/${r}: sent prompt hash`);
    const rj = readJson(join(runDir, 'run.json'));
    assert.equal(render(rj), brief.toString('utf8'), `${set}/${r}: render(run.json)`);
    n++;
  }
  assert.ok(n >= 21, `saw ${n} run folders`);
});
