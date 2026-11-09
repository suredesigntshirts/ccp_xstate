// select-tests.mjs: the guard files a change reaches, or all of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INERT, SHARED, reaches, select } from './select-tests.mjs';

const graph = reaches();
const files = (changed) => { const r = select(changed, { graph }); return r.all ? 'ALL' : r.files.map((f) => f.file); };

test('every guard file npm test runs is a guard here, and none under verify/', () => {
  assert.ok(graph.guards.length > 100, `${graph.guards.length} guards`);
  assert.ok(graph.guards.includes('test/docs.test.mjs') && graph.guards.includes('packages/engine/test/explain.test.js'));
  assert.deepEqual(graph.guards.filter((g) => g.startsWith('verify/') || g.includes('node_modules')), []);
});

test('a change to a shared file, or to a file no guard reaches outside the inert folders, selects all', () => {
  for (const f of SHARED) assert.equal(files([f]), 'ALL', f);
  assert.equal(files(['infra/somewhere-new.sh']), 'ALL');
  assert.equal(files(['a-new-top-level-file.txt']), 'ALL');
});

test('a file under an inert folder selects only the guards that read there; a changed guard selects itself', () => {
  assert.ok(INERT.includes('bench/') && INERT.includes('verify/'));
  assert.notEqual(files(['bench/nowhere-yet/new.md']), 'ALL');
  const verify = files(['verify/some-item/verdict.json']);
  assert.notEqual(verify, 'ALL');
  assert.ok(verify.includes('scripts/gates/test/pr-gate.test.mjs'), 'the gates read verify/');
  assert.ok(!verify.some((g) => g.startsWith('plugins/')), verify.join(' '));
  assert.ok(files(['test/docs.test.mjs']).includes('test/docs.test.mjs'));
});

test('code reaches the guards that import it, directly or through other modules', () => {
  const explain = files(['packages/engine/src/explain.js']);
  assert.ok(explain.includes('packages/engine/test/explain.test.js'), 'imported directly');
  assert.ok(explain.includes('test/regression/inspector/reads-records.test.mjs'), 'imported through the engine index');
  assert.ok(!explain.includes('test/docs.test.mjs'));
});

test('a script a guard spawns by path reaches it, and so does what that script imports', () => {
  assert.ok(files(['plan/check.mjs']).includes('test/plan-check.test.mjs'));
  const lib = files(['scripts/gates/lib.mjs']);
  assert.ok(lib.includes('scripts/gates/test/pr-gate.test.mjs'));
  assert.ok(lib.includes('test/regression/gates/verdict-cutoff.test.mjs'));
});

test('a plan-only change runs the plan and gates guards, and not the engine, plugin or inspector ones', () => {
  const plan = files(['plan/items/some-item.md']);
  assert.notEqual(plan, 'ALL');
  assert.ok(plan.includes('test/plan-check.test.mjs'));
  for (const g of plan) assert.doesNotMatch(g, /^(plugins\/|test\/regression\/(plugin|inspector)\/)/, g);
});

test('docs and CLAUDE.md reach the guards that read them', () => {
  assert.ok(files(['docs/layout.md']).includes('test/docs.test.mjs'));
  assert.ok(files(['CLAUDE.md']).includes('test/docs.test.mjs'));
});
