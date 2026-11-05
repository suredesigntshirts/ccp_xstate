// Expect cannot-start: the thread's own fail exit, owner only, refused for unknown, started or failed runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { project, briefRun } from './lib.mjs';

const denyOf = (out) => { assert.equal(out?.hookSpecificOutput?.permissionDecision, 'deny', JSON.stringify(out)); return out.hookSpecificOutput.permissionDecisionReason; };

test('cannot-start: the owner\'s prompt is denied, fails the run with its why, journals a row, item replanning; no later block', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  denyOf(p.agent(`ccp-cannot-start ${run}: no Agent tool here`, 'S'));
  assert.equal(p.failed(run).why, 'cannot-start: no Agent tool here');
  assert.equal(p.files(run).includes('spawn.json'), false);
  const rows = await p.refusals('a-1', 'cannot-start');
  assert.equal(rows.length, 1);
  assert.equal(p.show('a-1').state, 'replanning');
  assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1', 'stall')).length, 0);
  // Again on the failed run: refused, nothing changes.
  const before = (await p.rows('a-1')).length;
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: again`, 'S')), /^already-failed/);
  assert.equal(p.failed(run).why, 'cannot-start: no Agent tool here');
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 1);
  assert.ok((await p.rows('a-1')).length >= before);
});

test('cannot-start: from another session it is refused wrong-session and changes nothing', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: no Agent tool here`, 'T')), /^wrong-session/);
  assert.equal(p.failed(run), null);
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
  assert.equal(p.show('a-1').state, 'briefing');
  assert.equal(p.stop('S').decision, 'block', 'the run still waits for its owner');
});

test('cannot-start: an unknown run and a started run are refused and change nothing', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.match(denyOf(p.agent('ccp-cannot-start a-1:7.brief: nope', 'S')), /^unknown-run/);
  assert.match(denyOf(p.agent('ccp-cannot-start zz-9:0.brief: nope', 'S')), /^unknown-run/);
  p.agent(`ccp-run ${run}`, 'S');
  assert.ok(p.files(run).includes('spawn.json'));
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: changed my mind`, 'S')), /^already-started/);
  assert.equal(p.failed(run), null);
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
  assert.equal(p.show('a-1').state, 'briefing');
});

test('cannot-start: a run failed at the cap is refused already-failed and keeps its stalled why', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  p.stop('S'); p.stop('S'); assert.equal(p.stop('S'), null);
  assert.match(denyOf(p.agent(`ccp-cannot-start ${run}: late`, 'S')), /^already-failed/);
  assert.ok(p.failed(run).why.startsWith('stalled:'));
  assert.equal((await p.refusals('a-1', 'cannot-start')).length, 0);
});
