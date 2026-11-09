// explain: the engine's account of one event, checked on a small hand-written spec and against XState's own transition
// over every committed journal and the main tourney scenarios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { initialTransition, transition } from 'xstate';
import { explain } from '../src/explain.js';
import { failingOf, hashOf, loadWorkflow, machineOf } from '../src/index.js';
import { childEnv } from '../../../test/regression/lib.mjs';

const REPO = new URL('../../../', import.meta.url).pathname;

// A parent state with a child; both answer go. The child's answer needs ready; a timer and an invoke's result and error.
const SPEC = {
  id: 'tiny',
  initial: 'outer',
  context: { ok: null, ready: null },
  meta: {
    actors: { work: {} },
    guards: { ok: ['context.ok'], ready: ['context.ready'] },
    delays: { wait: 1000 }
  },
  states: {
    outer: {
      initial: 'inner',
      on: { go: [{ target: 'parentWay' }] },
      states: {
        inner: {
          on: { go: [{ guard: 'ok', target: 'guarded' }, { target: 'needy' }], set: { actions: [{ type: 'set', params: { ready: { value: true } } }], target: 'needy' } },
          after: { wait: { target: 'timedOut' } },
          invoke: { id: 'w', src: 'work', onDone: { target: 'worked' }, onError: { target: 'broke' } }
        },
        guarded: {},
        needy: { meta: { needs: ['ready'] } },
        timedOut: {},
        worked: {},
        broke: {}
      }
    },
    parentWay: { type: 'final' }
  }
};
const at = (value, context = {}) => ({ value, context: { ok: null, ready: null, ...context } });
const ways = (x) => x.tried.map((t) => [t.at, t.failing, t.taken]);

test('the deepest state is tried first, each state in file order; a failing guard and a failing need move on', () => {
  const x = explain(SPEC, at({ outer: 'inner' }), { type: 'go' });
  assert.deepEqual(ways(x), [
    ['/states/outer/states/inner/on/go/0', ['ok'], false],
    ['/states/outer/states/inner/on/go/1', ['ready'], false],
    ['/states/outer/on/go/0', [], true]
  ]);
  assert.equal(x.taken, '/states/outer/on/go/0');
  assert.deepEqual(x.tried[1].needs, ['ready']);
  assert.deepEqual(x.tried[0].tests, ['ok']);
  // With the guard holding, the first is taken and nothing after it is tried.
  assert.deepEqual(ways(explain(SPEC, at({ outer: 'inner' }, { ok: true }), { type: 'go' })), [['/states/outer/states/inner/on/go/0', [], true]]);
});

test('a need is checked on the context as the transition\'s actions leave it', () => {
  const x = explain(SPEC, at({ outer: 'inner' }), { type: 'set' });
  assert.deepEqual(ways(x), [['/states/outer/states/inner/on/set', [], true]]);
  assert.equal(x.tried[0].after, 'outer.needy');
});

test('an invoke\'s result and error and a timer answer XState\'s done, error and after events', () => {
  assert.equal(explain(SPEC, at({ outer: 'inner' }), { type: 'xstate.done.actor.w', output: {} }).taken, '/states/outer/states/inner/invoke/onDone');
  assert.equal(explain(SPEC, at({ outer: 'inner' }), { type: 'xstate.error.actor.w', error: 'x' }).taken, '/states/outer/states/inner/invoke/onError');
  assert.equal(explain(SPEC, at({ outer: 'inner' }), { type: 'xstate.after.wait.tiny.outer.inner' }).taken, '/states/outer/states/inner/after/wait');
  // Another state's timer is not this one's.
  assert.equal(explain(SPEC, at({ outer: 'inner' }), { type: 'xstate.after.wait.tiny.outer.guarded' }).taken, null);
});

test('an event nothing listens for tries nothing and takes nothing', () => {
  assert.deepEqual(explain(SPEC, at({ outer: 'guarded' }), { type: 'set' }), { tried: [], taken: null });
});

test('explain agrees with the machine: on the hand spec, the taken transition is where XState goes', () => {
  const machine = machineOf(SPEC);
  for (const [context, event] of [[{}, { type: 'go' }], [{ ok: true }, { type: 'go' }], [{}, { type: 'set' }], [{}, { type: 'xstate.done.actor.w', output: {} }]]) {
    const [start] = initialTransition(machine, context);
    const x = explain(SPEC, start, event);
    const [next] = transition(machine, start, event);
    const t = x.tried.find((y) => y.taken);
    assert.ok(JSON.stringify(next.value).includes(`"${t.after.split('.').pop()}"`), `${event.type}: ${t.after} vs ${JSON.stringify(next.value)}`);
    for (const y of x.tried) assert.deepEqual(y.failing, failingOf(SPEC, pointer(SPEC, y.at), stateAt(SPEC, y.after), { context: start.context, event }));
  }
});

const pointer = (spec, at) => at.split('/').slice(1).reduce((v, k) => v?.[k.replace(/~1/g, '/').replace(/~0/g, '~')], spec);
const stateAt = (spec, key) => key.split('.').reduce((s, k) => s?.states?.[k], spec);

// Every applied step of a journal root's items: XState lands where explain's taken transition leads, and an event that
// changed nothing took nothing. Returns the number of steps checked.
function agree(root) {
  let n = 0;
  for (const file of readdirSync(join(root, 'items')).filter((f) => f.endsWith('.jsonl'))) {
    const rows = readFileSync(join(root, 'items', file), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).filter((r) => r.kind === 'engine.transition');
    if (!rows.length) continue;
    const spec = loadWorkflow(rows[0].payload.workflow, { root });
    const machine = machineOf(spec);
    let snap = null;
    for (const { payload: p } of rows) {
      if (p.outcome !== 'applied') continue;
      if (!snap) { [snap] = initialTransition(machine, p.event.input); continue; }
      const x = explain(spec, snap, p.event);
      const [next] = transition(machine, snap, p.event);
      const t = x.tried.find((y) => y.taken);
      if (!t) assert.equal(hashOf(next), hashOf(snap), `${root} ${file} step ${p.seq}: changed with nothing taken`);
      else if (!t.stays) assert.ok(JSON.stringify(next.value).includes(`"${t.after.split('.').pop()}"`), `${root} ${file} step ${p.seq}: ${t.after} vs ${JSON.stringify(next.value)}`);
      assert.equal(x.tried.filter((y) => y.taken).length, t ? 1 : 0);
      n++;
      snap = next;
    }
  }
  return n;
}

test('explain agrees with XState over every committed journal', () => {
  const roots = [...new Set(execFileSync('git', ['-C', REPO, 'ls-files', '*/items/*.jsonl'], { encoding: 'utf8' }).split('\n').filter((f) => f && dirname(f).endsWith('/items')).map((f) => join(REPO, dirname(dirname(f)))))];
  let n = 0;
  for (const root of roots) n += agree(root);
  assert.ok(roots.length > 10 && n > 20, `${roots.length} roots, ${n} steps`);
});

test('explain agrees with XState over the main tourney scenarios Q1, Q3, Q5 and R1', { timeout: 600000 }, () => {
  let n = 0;
  for (const name of ['Q1', 'Q3', 'Q5', 'R1']) {
    const tmp = mkdtempSync(join(tmpdir(), `explain-${name}-`));
    execFileSync(process.execPath, ['--test', join(REPO, 'packages/engine/test/tourney', `${name}.test.js`)], { cwd: REPO, env: childEnv({ add: { TMPDIR: tmp } }), stdio: 'ignore' });
    const roots = [];
    const walk = (d, depth) => { if (depth > 4) return; for (const e of readdirSync(d, { withFileTypes: true })) if (e.isDirectory()) { const p = join(d, e.name); if (e.name === 'items') roots.push(d); else walk(p, depth + 1); } };
    walk(tmp, 0);
    assert.ok(roots.length, `${name} made a journal root`);
    for (const root of roots.filter((r) => existsSync(join(r, 'items')))) n += agree(root);
  }
  assert.ok(n > 20, `${n} steps`);
});
