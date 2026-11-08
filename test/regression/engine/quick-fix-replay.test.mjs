// Expect: wf-quick-fix/replays-110
// replay() on quick-fix: a journal recorded on today's quick-fix replays with every hash matching and ends done at the
// merge sha; a changed target or entry is refused; the pre-contract journal of #110 stops at entry 0.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initialTransition, transition } from 'xstate';
import { machineOf, replay, hashOf } from '../../../packages/engine/src/index.js';

const spec = JSON.parse(readFileSync(new URL('../../../workflows/quick-fix.json', import.meta.url), 'utf8'));
const entries110 = readFileSync(new URL('../../../packages/engine/test/fixtures/110-demo/journal.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));

const A = '53eb9a6af6711c985cd23fa9ec91276ed4329f3e';
const MERGE = '1ede79999083998a5b74e17feb9ff23ccefe8b65';
const issue = { url: 'https://github.com/o/r/issues/1', expect: ['x holds'] };
const url = 'https://github.com/o/r/pull/1';
const done = (id, output) => ({ type: `xstate.done.actor.${id}`, output });
// #110's path, in today's shapes: brief, build (CI green at accept), verify PASS at the head, approve, merge.
const events = [
  done('brief', { builder: 'b', verifier: 'v' }),
  done('build', { pr: { url, at: A, key: 'o/r#1', green: true } }),
  done('verify', { result: 'PASS', pr: { url, at: A }, issue, lines: [{ line: 'x holds', result: 'PASS', evidence: 'ran it' }] }),
  done('ask', { choice: 'approve', by: 'person' }),
  done('merge', { sha: MERGE })
];
const recorded = () => {
  const m = machineOf(spec);
  let [s] = initialTransition(m, { issue });
  const out = [{ seq: 0, event: { type: 'xstate.init', input: { issue } }, hash: hashOf(s) }];
  events.forEach((event, i) => { [s] = transition(m, s, event); out.push({ seq: i + 1, event, hash: hashOf(s) }); });
  return out;
};

test('replays-110: #110\'s pre-contract journal does not replay on the stage-contract quick-fix; it stops at entry 0', () => {
  assert.equal(entries110.length, 6);
  assert.ok(entries110.every((e) => e.hash), 'every entry carries #110\'s hash');
  assert.throws(() => replay(spec, entries110), /journal entry 0 replays to/);
});

test('replays: every recorded hash matches and the item ends done with the merge sha, its verdict at the PR head', () => {
  const entries = recorded();
  const s = replay(spec, entries);
  assert.equal(s.value, 'done'); assert.equal(s.status, 'done');
  assert.equal(s.output.merge.sha, MERGE);
  assert.equal(s.output.verdict.result, 'PASS');
  assert.equal(s.output.pr.at, A);
  assert.equal(s.output.verdict.pr.at, s.output.pr.at);
  assert.equal(hashOf(s), entries.at(-1).hash);
});

test('replays-110: a changed target is refused by replay', () => {
  const bad = structuredClone(spec);
  bad.states.verifying.invoke.onDone[2].target = 'replanning';
  assert.throws(() => replay(bad, recorded()), /the workflow changed|replays to/);
});

test('replays-110: a changed journal entry is refused by replay', () => {
  const bad = recorded();
  bad[3].event.output.result = 'FAIL';
  assert.throws(() => replay(spec, bad), /replays to/);
});
