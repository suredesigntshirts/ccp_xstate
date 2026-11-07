// Expect answers-unchanged and one-budget (the counts): every hook, called on a run in each state it can see, answers
// as main's did, writes the same run-folder files and the same journal rows apart from times, ids, hook sessions and
// run.json's attempts; and the attempts count every counted refusal, send-back and stall block.
// Main's answers: evidence/main/trace.json, written by `node verify/run-lifecycle-store/scenario.mjs <main 3b7b6e8> evidence/main`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { record } from './scenario.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const MAIN = JSON.parse(readFileSync(join(HERE, 'evidence', 'main', 'trace.json'), 'utf8'));
const noAttempts = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'attempts' ? undefined : v)));
const RESULT_RULES = ['schema', 'reserved', 'restated', 'covers', 'ref'];

const head = await record(REPO, join(tmpdir(), 'verify-rls-out'));

test('answers-unchanged: every step of every scenario returns, writes and journals what main did', () => {
  const scenarios = Object.keys(MAIN).filter((k) => k !== 'cont');
  assert.ok(scenarios.length >= 11, scenarios.join());
  let steps = 0;
  for (const name of scenarios) {
    assert.equal(head[name].length, MAIN[name].length, `${name}: steps`);
    MAIN[name].forEach((m, i) => {
      const h = head[name][i];
      assert.equal(h.label, m.label);
      for (const f of ['ret', 'changed', 'rows']) assert.deepEqual(noAttempts(h[f]), noAttempts(m[f]), `${name} / ${m.label} / ${f}`);
      steps++;
    });
  }
  assert.ok(steps >= 130, `${steps} steps`);
});

test('answers-unchanged: the hooks named in the Expect line are all called, in each state they can see', () => {
  const labels = Object.values(MAIN).flat().map((s) => s.label).join('\n');
  for (const hook of ['spawn', 'bind', 'bindLate', 'accept', 'handback', 'stopped', 'stall', 'cannotStart', 'waiting', 'ownedWaiting', 'resultsOf']) {
    assert.match(labels, new RegExp(`\\b${hook}\\b`), hook);
  }
  for (const state of ['prepared', 'spawned', 'bound', 'returned', 'failed']) assert.match(labels, new RegExp(`^${state}: cannotStart$`, 'm'), state);
  for (const state of ['spawned', 'bound', 'returned', 'failed']) assert.match(labels, new RegExp(`^${state}: spawn$`, 'm'), state);
});

test('one-budget: after every step, run.json attempts equal the counted refusals, send-backs and stall blocks so far', () => {
  for (const [name, steps] of Object.entries(head)) {
    if (name === 'cont') continue;
    const counted = {};
    steps.forEach((s) => {
      for (const r of s.rows) {
        if (r.kind !== 'refusal') continue;
        const key = `items/${r.payload.run.split(':')[0]}/runs/${r.payload.run.split(':')[1]}/run.json`;
        counted[key] ??= {};
        const kind = r.payload.outcome === 'denied' && RESULT_RULES.includes(r.payload.rule) ? 'refused' : r.payload.rule === 'sent-back' ? 'sentBack' : r.payload.rule === 'stall' ? 'stalled' : null;
        if (kind) counted[key][kind] = (counted[key][kind] ?? 0) + 1;
      }
      for (const key of new Set([...Object.keys(counted), ...Object.keys(s.attempts)])) {
        assert.deepEqual(s.attempts[key] ?? {}, counted[key] ?? {}, `${name} / ${s.label} / ${key}`);
      }
    });
  }
  // Main never writes attempts.
  assert.equal(JSON.stringify(MAIN).includes('"attempts":{"'), false);
});

test('one-budget: the run fails at the same attempt as on main (10th refusal, the end after a send-back, 3rd Stop)', () => {
  const failAt = (steps) => steps.find((s) => Object.keys(s.changed).some((k) => k.endsWith('failed.json')))?.label;
  for (const [name, at] of [['refusal-cap', 'refuse 10'], ['no-return-stop', 'stopped 2'], ['no-return-handback', 'stopped after handback deny'], ['no-return-again', 'stopped again'], ['no-return-handed-back', 'stopped handedBack'], ['stall-cap', 'stall 3'], ['stall-two', 'stall 3']]) {
    assert.equal(failAt(MAIN[name]), at, `main ${name}`);
    assert.equal(failAt(head[name]), at, `head ${name}`);
  }
  const last = head['refusal-cap'].find((s) => s.label === 'refuse 10');
  assert.equal(last.ret.failed, 'v-1:0.brief');
  assert.deepEqual(last.ret.fix.count, 10);
  assert.deepEqual(last.attempts['items/v-1/runs/0.brief/run.json'], { refused: 10 });
});
