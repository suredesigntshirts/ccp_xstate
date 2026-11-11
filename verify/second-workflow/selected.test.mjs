// selected: the start row records the pinned workflow and who picked it; a second start never repicks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { itemFile } from '../../packages/engine/src/names.js';
import { world, host } from './lib.mjs';

const ISSUE = { url: 'https://github.com/o/r/issues/1', expect: ['the feature works'] };
const INPUT = JSON.stringify({ issue: ISSUE, branch: 'build/feat' });
const rows = (root, item) => readFileSync(itemFile(root, item), 'utf8').trim().split('\n').map(JSON.parse);
const transitions = (root, item) => rows(root, item).filter((r) => r.kind === 'engine.transition');

test('the first row names feature@<sha256> and the person who picked it, and how, as the filing gave them', async () => {
  const w = world();
  const r = await host(w, ['start', '--item', 'it', '--workflow', 'feature', '--session', 'owner', '--input', INPUT, '--selected-by', 'Sure Team, the person', '--how', 'said "feature" in the triage thread']);
  assert.equal(r.status, 0, r.stderr);
  const [first] = transitions(w.root, 'it');
  assert.equal(first.payload.seq, 0);
  assert.match(first.payload.workflow, /^feature@[0-9a-f]{64}$/);
  assert.deepEqual(first.payload.selection, { workflow: first.payload.workflow, by: 'Sure Team, the person', how: 'said "feature" in the triage thread' });
});

test('a start with no --selected-by records the session that filed it as the picker, with no how', async () => {
  const w = world();
  assert.equal((await host(w, ['start', '--item', 'it', '--workflow', 'feature', '--session', 'owner', '--input', INPUT])).status, 0);
  const [first] = transitions(w.root, 'it');
  assert.deepEqual(first.payload.selection, { workflow: first.payload.workflow, by: 'claude-code owner', how: null });
});

test('--how alone, or an empty --selected-by, is refused and starts nothing', async () => {
  const w = world();
  const how = await host(w, ['start', '--item', 'a', '--workflow', 'feature', '--session', 'owner', '--input', INPUT, '--how', 'x']);
  assert.equal(how.status, 2);
  const blank = await host(w, ['start', '--item', 'b', '--workflow', 'feature', '--session', 'owner', '--input', INPUT, '--selected-by', '   ']);
  assert.equal(blank.out.state, null);
  assert.deepEqual(blank.out.results.map((x) => [x.outcome, x.reason]), [['refused', 'the selection names no one who picked the workflow']]);
  assert.ok(!existsSync(itemFile(w.root, 'a')), '--how alone writes nothing');
  assert.ok(!transitions(w.root, 'b').some((r) => r.payload.outcome === 'applied'), 'the blank selection started nothing');
});

for (const [workflow, by] of [['quick-fix', 'someone else'], ['feature', 'the person again'], ['research', null]]) {
  test(`a second start naming ${workflow}${by ? `, picked by ${by}` : ''}, is refused and the item keeps feature and its hash`, async () => {
    const w = world();
    assert.equal((await host(w, ['start', '--item', 'it', '--workflow', 'feature', '--session', 'owner', '--input', INPUT, '--selected-by', 'the person'])).status, 0);
    const before = transitions(w.root, 'it')[0].payload.workflow;
    const input = workflow === 'quick-fix' ? JSON.stringify({ issue: ISSUE }) : INPUT;
    const again = await host(w, ['start', '--item', 'it', '--workflow', workflow, '--session', 'owner', '--input', input, ...(by ? ['--selected-by', by] : [])]);
    const applied = transitions(w.root, 'it').filter((r) => r.payload.outcome === 'applied');
    assert.equal(applied.length, 1, 'only the first start applied');
    assert.ok(transitions(w.root, 'it').every((r) => r.payload.workflow === before));
    assert.equal(applied[0].payload.selection.by, 'the person');
    // The item still runs feature: show and its state say so.
    const shown = await host(w, ['show', '--item', 'it', '--workflow', workflow]);
    assert.equal(shown.out.state, 'planning');
    if (again.status === 0) assert.ok(again.out.results.every((x) => x.outcome !== 'applied'));
  });
}

test('a second start from another session is turned away too', async () => {
  const w = world();
  await host(w, ['start', '--item', 'it', '--workflow', 'feature', '--session', 'owner', '--input', INPUT, '--selected-by', 'the person']);
  await host(w, ['start', '--item', 'it', '--workflow', 'quick-fix', '--session', 'intruder', '--input', JSON.stringify({ issue: ISSUE }), '--selected-by', 'intruder']);
  const applied = transitions(w.root, 'it').filter((r) => r.payload.outcome === 'applied');
  assert.equal(applied.length, 1);
  assert.equal(applied[0].payload.selection.by, 'the person');
});
