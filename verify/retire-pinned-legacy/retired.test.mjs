// retired-not-run: an item pinned to a workflow this release's load check refuses is replayed and never advanced.
// Driven through the checkout's real loadWorkflow, restore, applyEvent, persist, runEffects, offer and deliver.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as L from './lib.mjs';

const { index, host: H, actors } = await L.engine();
const fileOf = (root, item) => join(root, 'items', `${item}.jsonl`);
const bytes = (f) => readFileSync(f, 'utf8');

/** Every way the host could advance the item, each checked to change nothing. */
async function assertNotRun({ root, item, session, release, message, event, run = null }) {
  const file = fileOf(root, item);
  const pin = L.pinOf(file);
  const spec = index.loadWorkflow(pin, { root });
  const why = index.retiredOf(spec);
  assert.ok(why, `${pin} loads retired`);
  assert.match(why, message);
  const host = H.restore({ root, item, spec, session, release: '9.9.9' });
  const before = { applied: L.applied(file).length, effects: L.effectRows(file).length, state: JSON.stringify(host.snapshot?.value) };

  const r = H.applyEvent(host, { event, run, source: { system: 'verify', ref: `offer ${item}` } });
  assert.equal(r.outcome, 'refused');
  assert.deepEqual(r.effects, []);
  const reason = r.row.payload.reason;
  for (const part of [item, pin, why, release]) assert.ok(reason.includes(part), `reason names ${part}: ${reason}`);
  H.persist(host, r.row);
  assert.equal(L.applied(file).length, before.applied, 'no applied row');
  assert.equal(JSON.stringify(host.snapshot?.value), before.state, 'the host did not move');

  const rec = L.recorder();
  const out = await H.runEffects(host, rec.handlers);
  assert.deepEqual(rec.calls, [], 'no handler called');
  assert.deepEqual(out.rows, []);
  assert.deepEqual(out.follow, []);
  assert.equal(L.effectRows(file).length, before.effects, 'no effect row');
  return { reason, why };
}

test('the adopt trial (done on 0.2.0) replays and is never advanced', async () => {
  const root = L.adoptCopy();
  const { reason } = await assertNotRun({
    root, item: 'trial', session: 'owner', release: '0.2.0', message: /state awaitingGates asks the person \(invoke ask\) and sets no timer/,
    event: { type: 'github.pull_request.closed' }
  });
  assert.match(reason, /finish it on release 0\.2\.0/);
});

test('a returned result from a committed adopt run, delivered, applies nothing (the same cut journal applies it at a runnable pin)', async () => {
  // Cut before seq 4, the verify run is open and its run folder holds its returned result.json.
  const root = L.adoptCopy(4);
  const file = fileOf(root, 'trial');
  const before = L.applied(file).length;
  const effects = L.effectRows(file).length;
  const host = H.restore({ root, item: 'trial', spec: index.loadWorkflow(L.pinOf(file), { root }), session: 'owner', release: '9.9.9' });
  assert.equal(host.runs.size, 1, 'the verify run is open');
  assert.equal(actors.resultsOf(host).length, 1, 'and its result is there to deliver');
  const got = await actors.deliver({ root, run: 'trial:3.verify' });
  assert.equal(got.error, undefined, JSON.stringify(got));
  assert.deepEqual(got.results.map((r) => r.outcome), ['refused']);
  assert.match(got.results[0].reason, /no longer runs/);
  assert.equal(L.applied(file).length, before, 'no applied row');
  assert.equal(L.effectRows(file).length, effects, 'no effect row');
  assert.deepEqual(got.waiting, []);
});

const preContract = (s) => { s.meta.actors.build = { prompt: 'old', task: 'Build the fix' }; delete s.meta.marks?.build; };
const noTimer = (s) => { delete s.states.awaitingGates.after; };

for (const [name, change, message] of [
  ['a pre-contract quick-fix copy', preContract, /actor build, invoked at \/states\/building\/invoke, is not a stage \(it lacks rules and inputs\), a host effect \(merge, ask, post\) or a workflow$/],
  ['a quick-fix copy whose awaitingGates has no after', noTimer, /state awaitingGates asks the person \(invoke ask\) and sets no timer/]
]) {
  test(`${name}, started on an earlier release, is never advanced; a current item in the same root advances`, async () => {
    const root = L.tempDir('pin');
    const pin = await L.pinCopy(root, change);
    await L.startAsEarlier(root, 'old', pin, '0.1.20');
    assert.equal(L.pinOf(fileOf(root, 'old')), pin);
    assert.equal(L.applied(fileOf(root, 'old')).length, 1);
    const run = L.applied(fileOf(root, 'old'))[0].payload;
    await assertNotRun({
      root, item: 'old', session: 'earlier', release: '0.1.20', message,
      event: { type: 'xstate.done.actor.brief', output: { builder: 'b', verifier: 'v' } }, run: `old:0.brief`
    });
    assert.ok(run);

    // A current quick-fix item, same root, same release: it starts and its first run is carried out.
    const spec = index.loadWorkflow('quick-fix', { root });
    assert.equal(index.retiredOf(spec), null);
    const host = H.restore({ root, item: 'new', spec, session: 'now', release: '9.9.9' });
    const rec = L.recorder();
    const results = await H.offer(host, [{ event: { type: 'xstate.init', input: L.startInput() }, source: { system: 'verify', ref: 'start new' } }], rec.handlers);
    assert.deepEqual(results.map((r) => r.outcome), ['applied']);
    assert.equal(host.snapshot.value, 'briefing');
    assert.deepEqual(rec.calls.map(([t, p]) => `${t} ${p}`), ['run start']);
    assert.ok(L.effectRows(fileOf(root, 'new')).length > 0);
  });
}

test('an item not yet started on a retired pin is refused its start, and none is written to its file', async () => {
  const root = L.tempDir('unstarted');
  const pin = await L.pinCopy(root, noTimer);
  const spec = index.loadWorkflow(pin, { root });
  const host = H.restore({ root, item: 'fresh', spec, session: 's', release: '9.9.9' });
  const r = H.applyEvent(host, { event: { type: 'xstate.init', input: L.startInput() }, source: { system: 'verify', ref: 'start fresh' } });
  assert.equal(r.outcome, 'refused');
  assert.match(r.row.payload.reason, /fresh is pinned to quick-fix@[0-9a-f]{64}, which this release no longer runs/);
  H.persist(host, r.row);
  assert.deepEqual(L.rows(fileOf(root, 'fresh')), []);
});
