// Expect same-text (plan item prompt-catalogue): for the same values every prompt and message is byte for byte what
// main gave before the item. The base fixtures (base-scenario.json, base-direct.json) were printed by scenario.mjs and
// direct.mjs run against a worktree of b5613ba (main before the item); literals.mjs holds that commit's template
// literals for the entries those runs don't reach. Verifier's own tests; the builder's are not used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scenario } from './scenario.mjs';
import { direct } from './direct.mjs';
import { LITERALS } from './literals.mjs';
import { render as stageRender } from '../../packages/engine/src/stages.js';
import { entries, render } from '../../packages/engine/src/messages.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const fixture = (name) => JSON.parse(readFileSync(join(HERE, name), 'utf8'));

test('same-text: render() on every committed run folder gives its brief.md', () => {
  const dirs = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8', maxBuffer: 1e8 }).split('\n')
    .filter((f) => f.endsWith('/brief.md')).map((f) => f.slice(0, -'/brief.md'.length)).filter((d) => existsSync(join(REPO, d, 'run.json')));
  assert.ok(dirs.length >= 300, `committed run folders: ${dirs.length}`);
  const differ = dirs.filter((d) => stageRender(JSON.parse(readFileSync(join(REPO, d, 'run.json'), 'utf8'))) !== readFileSync(join(REPO, d, 'brief.md'), 'utf8'));
  assert.deepEqual(differ, []);
});

test('same-text: every hook output, brief and context of the scripted quick-fix runs equals the base commit\'s', async () => {
  const s = await scenario(REPO);
  const want = fixture('base-scenario.json');
  assert.equal(s.out.length, want.out.length);
  for (let i = 0; i < want.out.length; i++) assert.deepEqual(s.out[i], want.out[i], `step ${want.out[i].step}`);
  assert.deepEqual(s.briefs, want.briefs);
  assert.ok(s.out.filter((o) => o.out).length >= 40);
});

test('same-text: accept() refusals and the text functions give the base commit\'s text', async () => {
  const got = await direct(REPO);
  const want = fixture('base-direct.json');
  for (const [k, v] of Object.entries(want)) assert.deepEqual(got[k], v, k);
});

test('same-text: the entries no run reaches render the base commit\'s template literal for the same values', () => {
  for (const [entry, values, literal] of LITERALS) assert.equal(render(entry, values), literal, entry);
});

test('same-text: the scenario, the direct calls and the literals reach every catalogue entry', async () => {
  // Which entries the runs render is read from the instrumented copy (evidence/catalogue.json); here the literals
  // plus that list must cover the catalogue.
  const reached = new Set([...fixture('evidence/reached-by-runs.json'), ...LITERALS.map(([e]) => e)]);
  assert.deepEqual([...entries().keys()].filter((e) => !reached.has(e)), []);
});
