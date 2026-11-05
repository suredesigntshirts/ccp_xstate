// Expect id `load-check` (fix-waiting-wake). A workflow with a state that invokes ask and has no after transition is
// refused at load, naming the workflow and the state; the three workflows in workflows/ load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadWorkflow } from '../../packages/engine/src/index.js';
import { fresh } from './lib.mjs';

const REPO = new URL('../../workflows/', import.meta.url).pathname;
const ASKING = { 'quick-fix': ['awaitingGates', 'awaitingMerge', 'blocked', 'replanning'], feature: ['replanning'], research: ['awaitingPublish', 'replanning'] };

test('load-check: the three workflows in workflows/ load', () => {
  for (const name of Object.keys(ASKING)) assert.ok(loadWorkflow(name).id.startsWith(`${name}@`));
  // wf-intake added workflows/intake.json: the three are still there, and every workflow in the folder loads.
  const files = readdirSync(REPO).filter((f) => f.endsWith('.json')).sort();
  for (const f of ['feature.json', 'quick-fix.json', 'research.json']) assert.ok(files.includes(f), f);
  for (const f of files) assert.ok(loadWorkflow(f.slice(0, -5)).id.startsWith(`${f.slice(0, -5)}@`), f);
});

test('load-check: every asking state has after.checkBack of one hour, and nothing else asks', () => {
  for (const [name, states] of Object.entries(ASKING)) {
    const w = JSON.parse(readFileSync(join(REPO, `${name}.json`), 'utf8'));
    assert.equal(w.meta.delays.checkBack, 3600000, `${name} meta.delays.checkBack`);
    const asking = Object.entries(w.states).filter(([, s]) => [s.invoke].flat().some((i) => i?.src === 'ask')).map(([k]) => k);
    assert.deepEqual(asking.sort(), [...states].sort(), `${name}'s asking states`);
    for (const s of states) {
      const t = w.states[s].after.checkBack;
      assert.ok(t && !t.target && !t.actions, `${name}.${s}: checkBack has no target and no actions`);
    }
  }
});

for (const [name, states] of Object.entries(ASKING)) {
  for (const state of states) {
    test(`load-check: ${name} with ${state}'s after removed is refused, naming both`, () => {
      const dir = fresh();
      cpSync(REPO, dir, { recursive: true });
      const w = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
      delete w.states[state].after;
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(w, null, 2));
      assert.throws(() => loadWorkflow(name, { dir }), (e) => {
        assert.match(e.message, new RegExp(`^${name}@[0-9a-f]{64}: `), 'names the workflow');
        assert.match(e.message, new RegExp(`state ${state} `), 'names the state');
        return true;
      });
      // And a root given: nothing is pinned for a refused workflow.
      const root = fresh();
      assert.throws(() => loadWorkflow(name, { dir, root }));
      assert.throws(() => readdirSync(join(root, 'blobs')));
    });
  }
}

test('load-check: an after with a delay name missing from meta.delays is refused too', () => {
  const dir = fresh();
  cpSync(REPO, dir, { recursive: true });
  const w = JSON.parse(readFileSync(join(dir, 'quick-fix.json'), 'utf8'));
  w.states.awaitingMerge.after = { nope: {} };
  writeFileSync(join(dir, 'quick-fix.json'), JSON.stringify(w, null, 2));
  assert.throws(() => loadWorkflow('quick-fix', { dir }), /awaitingMerge/);
});
