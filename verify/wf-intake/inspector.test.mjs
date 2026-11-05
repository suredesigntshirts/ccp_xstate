// Verifier's own test for wf-intake Expect `real` (the Inspector half): a bench run folder of each intake stage, built
// into the Workflow Inspector (scripts/inspector/build.mjs), shows the run: its prompt and its accepted result.
// Uses the builder's committed run folders, so it needs no model. At 13c4ffd the bench prepared a non-initial stage
// with no engine.transition row and the Inspector refused it ("cannot find the workflow null"): NOT MET. From d293235
// the bench starts every stage through the host (bench/challenge/runs/hosted/); the old baseline folders were not re-run.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = new URL('../../', import.meta.url).pathname;
const runFolder = (stage, kase, set = 'baseline') => join(REPO, 'bench', stage, 'runs', set, `${kase}.1`);
const resultOf = (journal) => {
  const items = join(journal, 'items');
  const item = readdirSync(items).find((n) => !n.endsWith('.jsonl'));
  // the run with a result: a later stage's folder also holds the earlier stage's run, opened and given the case output
  const run = readdirSync(join(items, item, 'runs')).find((r) => existsSync(join(items, item, 'runs', r, 'result.json')));
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

test('a challenge bench run folder (made through the host) is shown by the Inspector with its prompt and result', () => {
  const journal = runFolder('challenge', 'planted-half-met', 'hosted');
  const plain = build(journal);
  assert.ok(!plain.error, plain.error);
  assert.ok(plain.data.includes('You are the challenger'));
  const wrong = resultOf(journal).wrong_build;
  assert.ok(plain.data.includes(JSON.stringify(wrong).slice(1, -1).slice(0, 80)), 'challenge result in the page data');
});
