// Shared by the stage-prompt-files verifier tests: the base commit's workflows/ (before stage files), the head's
// workflows/, and render() calls on either with the same inputs.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadWorkflow } from '../../packages/engine/src/index.js';
import { render, stagesOf, chart } from '../../packages/engine/src/stages.js';

export const REPO = new URL('../..', import.meta.url).pathname;
/** PR #107's base: main after the stage-prompt-files replan (#106), before the build. */
export const BASE = 'c1306899d73c58e0281b26a87d66f67bdc2b3db1';
export const WORKFLOWS = ['quick-fix', 'research', 'feature'];
/** The 8 model stages the item names. */
export const STAGES = {
  'quick-fix': ['brief', 'build', 'verify'],
  research: ['brief', 'researcher', 'write', 'verify'],
  feature: ['brief']
};
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/**
 * The base commit's workflows/, copied to a temp folder. CI's checkout is shallow (depth 1), so the base's three
 * workflow files are committed beside these tests (base-workflows/, `git show <BASE>:workflows/<name>.json` bytes);
 * base-fixture.test.mjs checks them against git where the base commit is present.
 */
export const BASE_FIXTURES = new URL('./base-workflows/', import.meta.url).pathname;
export function baseWorkflows() {
  const out = mkdtempSync(join(tmpdir(), 'v-spf-base-'));
  cpSync(BASE_FIXTURES, out, { recursive: true });
  return out;
}

/** A scratch copy of this checkout's workflows/ (with the stage folders). */
export function scratchWorkflows() {
  const dir = mkdtempSync(join(tmpdir(), 'v-spf-wf-'));
  cpSync(join(REPO, 'workflows'), dir, { recursive: true });
  return dir;
}

/** The base raw JSON of a workflow, from the committed fixture. */
export const baseRaw = (name) => readJson(join(BASE_FIXTURES, `${name}.json`));
/** True when this clone has the base commit (a full clone; CI's shallow one does not). */
export const hasBase = () => {
  try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${BASE}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; }
};

export const load = (name, dir) => loadWorkflow(name, { dir });

/** The first invoke of `actor` in the chart. */
export const invokeOf = (spec, actor) => chart(spec).invokes.find((i) => i.src === actor);

/**
 * The input a stage's invoke would give it: each literal from the workflow (the brief's task) as wired in this
 * version, else made[name] (a recorded or made-up value), else null.
 */
export function inputFor(spec, actor, made = {}) {
  const inv = invokeOf(spec, actor);
  return Object.fromEntries(Object.entries(inv.input).map(([k, from]) => [
    k, from && typeof from === 'object' && 'value' in from ? from.value : Object.hasOwn(made, k) ? made[k] : null
  ]));
}

export const renderOn = (spec, actor, input, run) =>
  render({ actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run });

export { stagesOf };
