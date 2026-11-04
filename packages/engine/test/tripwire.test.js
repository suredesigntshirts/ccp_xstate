// The tripwire acted on (plan item engine-item-views): a PR past its round limit sends its item on. The row is the one
// derive.js rework appends (packages/journal/src/derive/rework.js, tripwires()), written into the item's own file;
// the host offers it once as a `tripwire` event, and the workflow decides what it means. Ported to the stage contract
// (engine-stage-contract): quick-fix no longer takes a tripwire (lane A removed it from the workflows), so these run
// on the fixture workflow test/fixtures/workflows/timed.json, which steps to tripped only when the event names its PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initialTransition, transition } from 'xstate';
import { restore, offer, loadWorkflow, machineOf } from '../src/index.js';
import { tripwiresOf } from '../src/tripwire.js';
import { append, readFile } from '../../journal/src/index.js';
import { tripwires } from '../../journal/src/derive/rework.js';
import { workflow as quickFix } from './flow.js';

const FIXTURES = new URL('./fixtures/workflows/', import.meta.url).pathname;
const workflow = loadWorkflow('timed', { dir: FIXTURES });
const PR = 'https://github.com/o/r/pull/1';
const TRIP = { type: 'tripwire', url: 'https://github.com/o/r/pull/1', rounds: 3, limit: 2 };

test('a tripwire on the item\'s PR moves it as the workflow says; another PR\'s tripwire does not', () => {
  const machine = machineOf(workflow);
  const [waiting] = initialTransition(machine, { pr: PR });
  assert.equal(waiting.value, 'waiting');
  const [after] = transition(machine, waiting, TRIP);
  assert.equal(after.value, 'tripped');
  assert.deepEqual([after.context.failure.tripwire, after.context.failure.rounds, after.context.failure.limit], [TRIP.url, 3, 2]);
  assert.equal(transition(machine, waiting, { ...TRIP, url: 'https://github.com/o/r/pull/9' })[0].value, 'waiting', 'another PR\'s tripwire is not this item\'s');
  assert.ok(!JSON.stringify(quickFix.states).includes('"tripwire"'), 'quick-fix takes no tripwire since lane A');
});

// An item of the fixture waiting on o/r#1.
async function waitingOn(root) {
  const host = restore({ root, item: 'it-1', spec: workflow, session: 'owner', release: '0.2.0' });
  await offer(host, [{ event: { type: 'xstate.init', input: { pr: PR } }, source: { system: 'claude-code', ref: 'owner' } }], {});
  return host;
}

test('the host offers rework\'s tripwire row for the item once, and the item moves on', async () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-trip-'));
  let host = await waitingOn(root);
  assert.equal(host.snapshot.value, 'waiting');
  assert.deepEqual(tripwiresOf(host), []);
  const view = { prs: [{ repo: 'o/r', pr: 1, item: 'it-1', rounds: 3, inputs: [] }] };
  const [row] = tripwires(view, [], { session: 'derive', release: '0.2.0' }, { limitOf: () => 2 });
  const written = append(host.file, row);

  host = restore({ root, item: 'it-1', spec: workflow, session: 'owner', release: '0.2.0' });
  const inputs = tripwiresOf(host);
  assert.equal(inputs.length, 1);
  assert.deepEqual(inputs[0].source, { system: 'journal', ref: `tripwire ${written.id}` });
  const [result] = await offer(host, inputs, {});
  assert.equal(result.outcome, 'applied');
  assert.equal(host.snapshot.value, 'tripped');
  assert.deepEqual(tripwiresOf(restore({ root, item: 'it-1', spec: workflow, session: 'owner', release: '0.2.0' })), [], 'offered once');
  const t = readFile(host.file).rows.filter((r) => r.kind === 'engine.transition' && r.payload.event.type === 'tripwire');
  assert.equal(t.length, 1);
});
