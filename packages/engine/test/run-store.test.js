// The run store: a run's state from its folder, transitions that leave only from their states, and the attempt
// budget counted in run.json. These are the builder's tests; the verifier writes its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { append } from '../../journal/src/index.js';
import { itemFile, runDir } from '../src/names.js';
import { answerOf, BUDGET, recordOf, spend, spent, state, STATES, transition, TRANSITIONS } from '../src/run/store.js';
import { REFUSAL_CAP, STALL_CAP } from '../src/actors.js';

const ITEM = 'it-1';
const RUN = `${ITEM}:0.build`;
const record = { run: RUN, item: ITEM, name: '0.build', actor: 'build', session: 's-1', release: '0.0.0', state: '"building"', worktree: '/w' };

function prepared() {
  const root = mkdtempSync(join(tmpdir(), 'run-store-'));
  assert.equal(transition(root, record, 'prepare', record), true);
  return root;
}
const files = (root) => readdirSync(runDir(root, RUN)).sort();
const kinds = (root) => {
  try {
    return readFileSync(itemFile(root, ITEM), 'utf8').trim().split('\n').map((l) => JSON.parse(l).kind);
  } catch {
    return [];
  }
};

test('a run moves prepared, spawned, bound, returned, and each state is read from its folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'run-store-'));
  assert.equal(state(root, RUN), null);
  assert.equal(transition(root, record, 'prepare', record), true);
  assert.equal(state(root, RUN), 'prepared');
  assert.equal(transition(root, record, 'spawn', { toolUseId: 'tu-1', session: 's-1' }), true);
  assert.equal(state(root, RUN), 'spawned');
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'actors', 'spawns', 'tu-1.json'), 'utf8')), { run: RUN, session: 's-1' });
  assert.equal(transition(root, record, 'bind', { agentId: 'ag-1', toolUseId: 'tu-1', via: 'meta' }, { kind: 'agent.spawn', source: { system: 'claude-code', ref: 'tu-1' }, payload: { run: RUN } }), true);
  assert.equal(state(root, RUN), 'bound');
  assert.equal(JSON.parse(readFileSync(join(root, 'actors', 'agents', 'ag-1.json'), 'utf8')).verified, true);
  assert.equal(transition(root, record, 'return', { result: {}, hash: 'h' }, { kind: 'result.stored', source: { system: 'journal', ref: 'blobs/h' }, payload: { run: RUN } }), true);
  assert.equal(state(root, RUN), 'returned');
  assert.deepEqual(kinds(root), ['agent.spawn', 'result.stored']);
  assert.deepEqual(STATES, ['prepared', 'spawned', 'bound', 'returned', 'failed']);
});

test('a transition from a state it does not leave from writes nothing and journals nothing', () => {
  const root = prepared();
  const before = files(root);
  const row = { kind: 'refusal', source: { system: 'hook', ref: 'x' }, payload: { run: RUN } };
  assert.equal(transition(root, record, 'bind', { agentId: 'ag-1', toolUseId: 'tu-1' }, row), false);
  assert.equal(transition(root, record, 'return', { result: {} }, row), false);
  assert.equal(transition(root, record, 'send-back', { agentId: 'ag-1' }, row), false);
  assert.deepEqual(files(root), before);
  assert.deepEqual(kinds(root), []);
  assert.equal(transition(root, record, 'fail', { agentId: null, why: 'stalled' }, row), true);
  assert.equal(state(root, RUN), 'failed');
  assert.equal(transition(root, record, 'spawn', { toolUseId: 'tu-2', session: 's-1' }), false);
  assert.equal(transition(root, record, 'fail', { agentId: null, why: 'again' }, row), false);
  assert.deepEqual(kinds(root), ['refusal']);
  assert.throws(() => transition(root, record, 'teleport', {}), /no run transition teleport/);
  assert.deepEqual(Object.keys(TRANSITIONS), ['prepare', 'spawn', 'bind', 'return', 'send-back', 'fail']);
});

test('each hook answers a state it cannot act in with one catalogue entry', () => {
  assert.equal(answerOf('spawn', 'prepared'), null);
  assert.equal(answerOf('spawn', 'spawned'), 'spawn-started-elsewhere');
  assert.equal(answerOf('spawn', 'bound'), 'spawn-already-started');
  assert.equal(answerOf('spawn', 'failed'), 'spawn-already-failed');
  assert.equal(answerOf('cannot-start', 'prepared'), null);
  assert.equal(answerOf('cannot-start', 'returned'), 'cannot-start-already-started');
  assert.equal(answerOf('return', 'bound'), null);
  assert.equal(answerOf('return', 'returned'), 'already-returned');
  const root = prepared();
  transition(root, record, 'fail', { agentId: 'ag-1', why: 'refused 10 times' });
  assert.equal(answerOf('return', 'failed', root, RUN), 'already-failed-refused');
});

test('the budget is one table, the caps read from it, and run.json counts what was spent', () => {
  assert.deepEqual(BUDGET, { refused: 10, sentBack: 1, stalled: 2 });
  assert.equal(REFUSAL_CAP, BUDGET.refused);
  assert.equal(STALL_CAP, BUDGET.stalled);
  const root = prepared();
  const written = readFileSync(join(runDir(root, RUN), 'run.json'), 'utf8');
  assert.equal(recordOf(root, RUN).attempts, undefined, 'a prepared run.json has no attempts');
  assert.equal(spend(root, record, 'refused'), 1);
  assert.equal(spend(root, record, 'refused'), 2);
  assert.equal(spend(root, record, 'stalled'), 1);
  assert.deepEqual(recordOf(root, RUN).attempts, { refused: 2, stalled: 1 });
  assert.equal(spent(root, record, 'sentBack'), 0);
  const { attempts, ...rest } = recordOf(root, RUN);
  assert.deepEqual(rest, JSON.parse(written), 'spending changes only attempts');
  assert.throws(() => spend(root, record, 'tries'), /no attempt kind tries/);
});

test('a run.json written without attempts counts from its journal rows, then carries on in run.json', () => {
  const root = prepared();
  mkdirSync(join(root, 'items'), { recursive: true });
  const row = (rule, outcome) => ({ v: 2, session: 's-1', release: '0.0.0', state: null, item: ITEM, kind: 'refusal', source: { system: 'hook', ref: 'x' }, agent: null, payload: { rule, outcome, run: RUN } });
  for (const r of [row('schema', 'denied'), row('ref', 'denied'), row('wrong-caller', 'denied'), row('stall', 'blocked')]) append(itemFile(root, ITEM), r);
  assert.equal(spent(root, record, 'refused'), 2, 'wrong-caller does not count');
  assert.equal(spent(root, record, 'stalled'), 1);
  writeFileSync(join(runDir(root, RUN), 'sent-back.json'), '{}\n');
  assert.equal(spent(root, record, 'sentBack'), 1);
  assert.equal(spend(root, record, 'refused'), 3);
  assert.equal(recordOf(root, RUN).attempts.refused, 3);
});
