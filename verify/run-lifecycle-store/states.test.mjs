// Expect states-true: the head's store.state reads every run folder main's engine left (one per end state and failure
// kind, evidence/main/states/<scenario>/<milestone>/) and every committed run folder as main's own checks would, and a
// transition from a state it does not leave from writes nothing and returns false.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATES, TRANSITIONS, state, transition } from '../../packages/engine/src/run/store.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const KEPT = join(HERE, 'evidence', 'main', 'states');
const RUN = 'v-1:0.brief';

// What each milestone is, from the hook that made it (scenario.mjs), not from the store.
const EXPECTED = {
  'returned/prepared': 'prepared', 'returned/spawned': 'spawned', 'returned/bound': 'bound', 'returned/returned': 'returned',
  'refusal-cap/failed': 'failed', 'no-return-stop/sent-back': 'bound', 'no-return-stop/failed': 'failed',
  'no-return-again/failed': 'failed', 'no-return-handback/failed': 'failed', 'no-return-handed-back/failed': 'failed',
  'stall-cap/failed': 'failed', 'cannot-start/failed': 'failed', 'cannot-start-started/bound': 'bound'
};
// Why each failed: the start of failed.json's why, as main wrote it.
const WHY = {
  'refusal-cap/failed': 'refused 10 times', 'no-return-stop/failed': 'the actor ended (SubagentStop)', 'no-return-again/failed': 'the actor ended (SubagentStop)',
  'no-return-handback/failed': 'the actor ended (SubagentStop)', 'no-return-handed-back/failed': 'the actor ended (SubagentStop, after a handback)', 'stall-cap/failed': 'stalled',
  'cannot-start/failed': 'cannot-start'
};

const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const bytes = (root) => Object.fromEntries(existsSync(root) ? files(root).map((p) => [relative(root, p), readFileSync(p, 'utf8')]) : []);

test('states-true: main\'s run folders, one per end state and failure kind, read as the state that made them', () => {
  const kept = readdirSync(KEPT).flatMap((s) => readdirSync(join(KEPT, s)).map((m) => `${s}/${m}`)).filter((k) => k !== 'stall-two/end').sort();
  assert.deepEqual(kept, Object.keys(EXPECTED).sort());
  for (const k of kept) {
    assert.equal(state(join(KEPT, k), RUN), EXPECTED[k], k);
    if (WHY[k]) assert.ok(JSON.parse(readFileSync(join(KEPT, k, 'items/v-1/runs/0.brief/failed.json'), 'utf8')).why.startsWith(WHY[k]), k);
  }
  // The second item of stall-two: blocked twice, still prepared.
  assert.equal(state(join(KEPT, 'stall-two/end'), 'v-1:0.brief'), 'failed');
  assert.equal(state(join(KEPT, 'stall-two/end'), 'v-2:0.brief'), 'prepared');
  assert.equal(state(join(KEPT, 'returned/prepared'), 'v-1:7.none'), null);
});

// Main's checks, written out: spawn() denies failed before started; accept() takes result before failed; a run folder
// with spawn.json and no agent.json is a started Agent call.
function mainState(dir) {
  const has = (f) => existsSync(join(dir, f));
  if (!has('run.json')) return null;
  if (has('result.json')) return 'returned';
  if (has('failed.json')) return 'failed';
  if (has('agent.json')) return 'bound';
  if (has('spawn.json')) return 'spawned';
  return 'prepared';
}

test('states-true: every committed run folder under verify/engine-toy-run/evidence and bench/brief/runs reads as main would', () => {
  const found = [];
  for (const top of ['verify/engine-toy-run/evidence', 'bench/brief/runs']) {
    for (const p of files(join(REPO, top)).filter((p) => p.endsWith('/run.json') && p.includes('/items/') && p.includes('/runs/'))) {
      const dir = dirname(p);
      const parts = dir.split('/');
      const i = parts.lastIndexOf('items');
      const root = parts.slice(0, i).join('/');
      const id = `${parts[i + 1]}:${parts[i + 3]}`;
      found.push([relative(REPO, dir), state(root, id), mainState(dir)]);
    }
  }
  assert.ok(found.length >= 150, `${found.length} folders`);
  for (const [dir, got, want] of found) assert.equal(got, want, dir);
  const by = found.reduce((a, [, s]) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
  console.log(`# ${found.length} committed run folders: ${JSON.stringify(by)}`);
});

test('states-true: a transition from a state it does not leave from writes nothing and returns false', () => {
  const tried = [];
  for (const k of Object.keys(EXPECTED)) {
    const current = EXPECTED[k];
    for (const [event, t] of Object.entries(TRANSITIONS)) {
      if (t.from.includes(current)) continue;
      const root = mkdtempSync(join(tmpdir(), 'verify-rls-guard-'));
      cpSync(join(KEPT, k), root, { recursive: true });
      const before = bytes(root);
      const run = JSON.parse(readFileSync(join(root, 'items/v-1/runs/0.brief/run.json'), 'utf8'));
      const row = { kind: 'refusal', source: { system: 'hook', ref: 'x' }, payload: { run: RUN, rule: 'probe' } };
      const got = transition(root, run, event, { agentId: 'x', toolUseId: 'tu-x', session: 's', run: RUN }, row);
      assert.equal(got, false, `${k}: ${event}`);
      assert.deepEqual(bytes(root), before, `${k}: ${event} wrote nothing`);
      tried.push(`${current}:${event}`);
    }
  }
  assert.ok(STATES.every((s) => s === 'prepared' || tried.some((t) => t.startsWith(`${s}:`))), tried.join());
  console.log(`# ${tried.length} refused transitions, e.g. ${[...new Set(tried)].join(' ')}`);
});
