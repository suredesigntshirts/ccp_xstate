// The load check that every state asking the person sets a timer (plan item fix-waiting-wake, Expect load-check;
// plan/decisions/2026-11-04-waiting-wake.md): a workflow with an asking state and no after transition is refused,
// naming the workflow and the state; the workflows in workflows/ load; an item pinned before the check still loads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, readWorkflow } from '../src/index.js';
import { checkStages } from '../src/stages.js';

const WORKFLOWS = new URL('../../../workflows/', import.meta.url).pathname;
const names = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, ''));
const read = (name) => structuredClone(readWorkflow(name, { dir: WORKFLOWS }).spec);
const asking = (spec) => Object.entries(spec.states).filter(([, s]) => s.invoke?.src === 'ask').map(([n]) => n);

test('every workflow in workflows/ loads, and each asking state has its checkBack timer', () => {
  for (const name of names) {
    const spec = loadWorkflow(name);
    assert.ok(asking(spec).length > 0, `${name} asks the person somewhere`);
    for (const state of asking(spec)) assert.deepEqual(Object.keys(spec.states[state].after ?? {}), ['checkBack'], `${name} ${state}`);
    assert.equal(spec.meta.delays.checkBack, 3600000);
  }
});

test('an asking state with no timer is refused, naming the workflow and the state', () => {
  for (const name of names) {
    for (const state of asking(read(name))) {
      const spec = read(name);
      delete spec.states[state].after;
      assert.throws(() => checkStages({ ...spec, id: name }, { workflows: names }),
        (e) => e.message.startsWith(`${name}: state ${state} asks the person`) && /sets no timer/.test(e.message), `${name} ${state}`);
    }
  }
});

test('a delay that names no meta.delays entry, or not a positive one, is refused', () => {
  const spec = read('quick-fix');
  delete spec.meta.delays;
  assert.throws(() => checkStages({ ...spec, id: 'quick-fix' }, { workflows: names }), /waits on delay checkBack, which is neither/);
  const zero = read('quick-fix');
  zero.meta.delays.checkBack = 0;
  assert.throws(() => checkStages({ ...zero, id: 'quick-fix' }, { workflows: names }), /waits on delay checkBack/);
  const ms = read('quick-fix');
  ms.states.awaitingMerge.after = { 60000: ms.states.awaitingMerge.after.checkBack };
  assert.doesNotThrow(() => checkStages({ ...ms, id: 'quick-fix' }, { workflows: names }));
});

test('an item pinned to a workflow from before the check still loads it', () => {
  const root = mkdtempSync(join(tmpdir(), 'waits-'));
  const old = read('quick-fix');
  for (const state of asking(old)) delete old.states[state].after;
  const bytes = Buffer.from(JSON.stringify(old));
  const hash = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'blobs'));
  writeFileSync(join(root, 'blobs', hash), bytes);
  const spec = loadWorkflow(`quick-fix@${hash}`, { root });
  assert.equal(spec.states.awaitingMerge.after, undefined);
});
