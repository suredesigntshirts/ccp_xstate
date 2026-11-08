// Retired workflows: a pinned workflow this release's load check refuses loads, marked with the check's message, so its
// journal replays, and the host advances its item no further: applyEvent turns its events away and runEffects runs
// nothing. The committed adopt trial is one: its quick-fix pin asks the person at awaitingGates with no timer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, retiredOf, workflowOf } from '../src/index.js';
import { applyEvent, restore, runEffects } from '../src/host.js';
import { WORKFLOWS } from './tourney/contract.js';

const ADOPT = new URL('../../../tournaments/2026-11-04-stage-contract/trials/adopt/journal/', import.meta.url).pathname;

const rowsOf = (file) => readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const firstRow = (root, item) => rowsOf(join(root, 'items', `${item}.jsonl`)).find((r) => r.kind === 'engine.transition' && r.payload.seq === 0);

/** A copy of the adopt trial's journal root, so nothing the host might write lands in the repo. */
const adoptCopy = () => {
  const root = mkdtempSync(join(tmpdir(), 'retired-adopt-'));
  cpSync(ADOPT, root, { recursive: true });
  return root;
};

/** A changed copy of a repo workflow, pinned as a blob under a fresh root: its pin. */
const pinChanged = (root, name, change) => {
  const spec = structuredClone(WORKFLOWS[name]);
  change(spec);
  const bytes = JSON.stringify(spec);
  const hash = createHash('sha256').update(bytes).digest('hex');
  mkdirSync(join(root, 'blobs'), { recursive: true });
  writeFileSync(join(root, 'blobs', hash), bytes);
  return `${name}@${hash}`;
};

test('the adopt trial pin loads retired, naming its asking state without a timer, and its journal replays', () => {
  const root = adoptCopy();
  const spec = workflowOf(root, 'trial');
  assert.match(spec.id, /^quick-fix@[0-9a-f]{64}$/);
  assert.match(retiredOf(spec), /state awaitingGates asks the person \(invoke ask\) and sets no timer/);
  const host = restore({ root, item: 'trial', spec, session: firstRow(root, 'trial').session, release: '0.0.0' });
  assert.ok(host.seq > 0);
  assert.equal(host.startedOn, firstRow(root, 'trial').release);
  // The mark is not part of the spec's bytes: a copy or a hash never carries it.
  assert.ok(!Object.keys(spec).includes('retired'));
  assert.equal(retiredOf({ ...spec }), null);
});

test('the host turns every event to a retired item away, naming the pin, why and the release to finish it on', () => {
  const root = adoptCopy();
  const spec = workflowOf(root, 'trial');
  const first = firstRow(root, 'trial');
  const host = restore({ root, item: 'trial', spec, session: first.session, release: '0.0.0' });
  const seq = host.seq;
  const r = applyEvent(host, { event: { type: 'xstate.after.checkBack' }, source: { system: 'test', ref: 'retired-1' } });
  assert.equal(r.outcome, 'refused');
  assert.deepEqual(r.effects, []);
  assert.ok(r.row.payload.reason.includes(retiredOf(spec)), 'the reason holds the load check\'s message');
  assert.match(r.row.payload.reason, new RegExp(`^trial is pinned to ${spec.id}, which this release no longer runs \\(.*\\): finish it on release ${first.release.replaceAll('.', '\\.')}, which started it$`));
  assert.equal(host.seq, seq, 'nothing moved');
});

test('runEffects carries out none of a retired item\'s effects', async () => {
  const root = adoptCopy();
  const spec = workflowOf(root, 'trial');
  const host = restore({ root, item: 'trial', spec, session: firstRow(root, 'trial').session, release: '0.0.0' });
  // Make sure there is an effect to skip.
  host.effects.set('trial:99.probe', { effect: { id: 'trial:99.probe', type: 'probe' }, phase: null, outcome: null });
  let called = 0;
  const out = await runEffects(host, { probe: { start: () => { called += 1; return {}; } } });
  assert.deepEqual(out, { rows: [], follow: [] });
  assert.equal(called, 0);
});

test('pre-contract and timerless pins load retired; a current pin does not', () => {
  const root = mkdtempSync(join(tmpdir(), 'retired-pins-'));
  const preContract = pinChanged(root, 'quick-fix', (s) => { for (const a of ['brief', 'build', 'verify']) { delete s.meta.actors[a].rules; delete s.meta.actors[a].inputs; } });
  assert.match(retiredOf(loadWorkflow(preContract, { root })), /actor brief, invoked at \/states\/briefing\/invoke, is not a stage \(it lacks rules and inputs\)/);
  const timerless = pinChanged(root, 'quick-fix', (s) => { delete s.states.awaitingGates.after; });
  assert.match(retiredOf(loadWorkflow(timerless, { root })), /state awaitingGates asks the person/);
  const current = loadWorkflow('quick-fix', { root });
  assert.equal(retiredOf(current), null);
  assert.equal(retiredOf(loadWorkflow(current.id, { root })), null);
});

test('an item on a current pin starts and advances', () => {
  const root = mkdtempSync(join(tmpdir(), 'retired-current-'));
  const spec = loadWorkflow('quick-fix', { root });
  const host = restore({ root, item: 'cur', spec, session: 's1', release: '0.0.0' });
  const r = applyEvent(host, { event: { type: 'xstate.init', input: { issue: { url: 'https://github.com/o/r/issues/1', title: 't', body: 'b', expect: ['x'] } } }, source: { system: 'test', ref: 'start cur' } });
  assert.equal(r.outcome, 'applied', JSON.stringify(r.row?.payload?.reason));
});
