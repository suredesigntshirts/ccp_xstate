// C-stale-completion-dropped (plan/cases/work-item.md): a builder run replaced by a newer run; when the old run's
// completion arrives, it is journalled as stale and changes nothing. Ported to the stage contract: quick-fix has no build
// timeout (lane A removed timers), so the old run is replaced the way a run now ends without its result: its agent
// stopped without returning and the hook failed the run (the actor's error), the person replans, a new build run
// starts, and then the old build's result arrives late.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { A, BRIEFS, agents, cardOf, fresh, hashOfHost, offer, open, openRun, platform, pr, start, transitions, world } from './world.js';

test('C-stale-completion-dropped: the replaced build run\'s completion is journalled stale and the item is unchanged', async () => {
  const root = fresh();
  const host = open(root);
  const plat = platform();
  const a = agents({ brief: [BRIEFS, BRIEFS] }); // builds never return on their own
  const effects = world({ plat, actors: a.byActor });
  await offer(host, [{ ...start(), at: '2026-11-01T10:00:00.000Z' }], effects);
  assert.equal(host.snapshot.value, 'building');
  const oldBuild = openRun(host, 'build');

  await offer(host, [{ event: { type: 'xstate.error.actor.build', error: 'no-return: the agent stopped without returning' }, run: oldBuild.id, source: { system: 'harness', ref: 'stop ag-old' } }], effects);
  assert.equal(host.snapshot.value, 'replanning');
  const ask = openRun(host, 'ask');
  await offer(host, [{ event: { type: 'xstate.done.actor.ask', output: { choice: 'replan', by: 'person', why: 'the build hung' } }, run: ask.id, source: { system: 'hearth', ref: cardOf(host, ask) } }], effects);
  assert.equal(host.snapshot.value, 'building');
  const newBuild = openRun(host, 'build');
  assert.notEqual(newBuild.id, oldBuild.id);

  const before = hashOfHost(host);
  const [late] = await offer(host, [{ event: { type: 'xstate.done.actor.build', output: pr(A) }, run: oldBuild.id, source: { system: 'harness', ref: 'return old-build' } }], effects);
  assert.equal(late.outcome, 'stale');
  assert.match(late.row.payload.reason, new RegExp(`run ${oldBuild.id} is not in flight`));
  assert.equal(hashOfHost(host), before);
  assert.equal(openRun(host, 'build').id, newBuild.id, 'the new run is still the open one');
  const row = transitions(root).find((r) => r.source.ref === 'return old-build');
  assert.deepEqual([row.payload.outcome, row.payload.run], ['stale', oldBuild.id]);

  // The new run's completion is taken.
  const [fresh2] = await offer(host, [{ event: { type: 'xstate.done.actor.build', output: pr(A) }, run: newBuild.id, source: { system: 'harness', ref: 'return new-build' } }], effects);
  assert.equal(fresh2.outcome, 'applied');
  assert.equal(host.snapshot.value, 'verifying');
});
