// Verifier's own test for wf-intake Expect `real` (the Inspector half): a bench run folder of each intake stage, built
// into the Workflow Inspector (scripts/inspector/build.mjs), shows the run: its prompt and its accepted result.
// Uses the builder's committed baseline run folders, so it needs no model. The challenge half is `todo`: at 13c4ffd
// the bench prepares a non-initial stage with no engine.transition row, and the Inspector shows such a folder as
// "0 steps, 0 model agent runs" (or refuses it: "cannot find the workflow null") instead of the run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('../../', import.meta.url).pathname;
const runFolder = (stage, kase) => join(REPO, 'bench', stage, 'runs', 'baseline', `${kase}.1`);
const resultOf = (journal) => {
  const items = join(journal, 'items');
  const item = readdirSync(items).find((n) => !n.endsWith('.jsonl'));
  const run = readdirSync(join(items, item, 'runs'))[0];
  return JSON.parse(readFileSync(join(items, item, 'runs', run, 'result.json'), 'utf8')).result;
};

function build(journal, workflow = null) {
  const out = mkdtempSync(join(tmpdir(), 'vwi-insp-'));
  const conf = join(out, 'conf.json');
  writeFileSync(conf, JSON.stringify({ engines: { [REPO]: 'Main' }, sources: [{ origin: 'Verifier', kind: 'real', engine: REPO, journal, ...(workflow && { workflow }), label: 'v' }] }));
  try {
    execFileSync(process.execPath, [join(REPO, 'scripts/inspector/build.mjs'), '--config', conf, '--out', join(out, 'page')], { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (error) {
    return { error: String(error.stderr ?? error.message) };
  }
  return { data: readFileSync(join(out, 'page', 'data.js'), 'utf8') };
}

test('a shape bench run folder is shown by the Inspector with its prompt and result', () => {
  const journal = runFolder('shape', 'planted-half-rule');
  const got = build(journal);
  assert.ok(!got.error, got.error);
  assert.ok(got.data.includes('You are the issue writer'));
  const title = resultOf(journal).issue.title;
  assert.ok(got.data.includes(JSON.stringify(title).slice(1, -1)), `result title ${title} in the page data`);
});

test('a challenge bench run folder is shown by the Inspector with its prompt and result', { todo: 'NOT MET at 13c4ffd: no engine.transition rows in a challenge run folder' }, () => {
  const journal = runFolder('challenge', 'planted-half-met');
  const plain = build(journal);
  assert.ok(!plain.error, plain.error);
  const wrong = resultOf(journal).wrong_build;
  assert.ok(plain.data.includes(JSON.stringify(wrong).slice(1, -1).slice(0, 80)), 'challenge result in the page data');
});
