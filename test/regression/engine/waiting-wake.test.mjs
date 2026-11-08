// Expect: fix-waiting-wake/scheduled, fix-waiting-wake/fires-holds, fix-waiting-wake/load-check
// Asking states and their one-hour checkBack timer: every asking state of the three workflows asks for one wake, and
// leaving the state drops it; a wake before the due time fires nothing, a wake past it journals the timer's event and the
// item holds, and a tap still moves it; a workflow whose asking state has no after transition is refused at load.
import { mkdtempSync, readFileSync, cpSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, inputsOfWake, loadWorkflow, itemFile } from '../../../packages/engine/src/index.js';
import { handlers } from '../../../packages/engine/src/effects/index.js';
import { readFile } from '../../../packages/journal/src/index.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeGitHub } from '../../../packages/engine/test/parity/world.js';

const HOUR = 3600000;
const A = 'a'.repeat(40);
const B = 'b'.repeat(40);
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x works'] };
const PR_URL = 'https://github.com/o/r/pull/1';
const PR = (at, extra = {}) => ({ pr: { url: PR_URL, at, key: 'o/r#1', green: true, ...extra } });
const VERDICT = (at, pr = {}) => ({ result: 'PASS', pr: { url: PR_URL, at, ...pr }, issue: ISSUE, lines: [{ line: 'x works', result: 'PASS', evidence: 'e' }] });
const PUSH = (sha) => ({ type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' });

const fresh = () => mkdtempSync(join(tmpdir(), 'verify-fww-'));
const open = (root, item, workflow = 'quick-fix', session = 'owner') =>
  restore({ root, item, spec: loadWorkflow(workflow, { root }), session, release: '0.2.0' });
const start = (session = 'owner', input = { issue: ISSUE }) =>
  ({ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: session } });
const rowsOf = (root, item) => readFile(itemFile(root, item)).rows;

/** The thread and the clock, recording. A card is closed by its run key. */
function world() {
  const cards = [];
  const closes = [];
  const wakes = [];
  const drops = [];
  let n = 0;
  return {
    cards, closes, wakes, drops,
    hearth: {
      card: async ({ key, question, choices }) => { const c = { key, ref: `cmsg_c${++n}`, question, choices, closed: false }; cards.push(c); return { ref: c.ref }; },
      post: async ({ key, text }) => ({ ref: `cmsg_p${++n}` }),
      close: async ({ key }) => { closes.push(key); const c = cards.find((x) => x.key === key); if (!c) return null; c.closed = true; return { ref: c.ref }; },
      find: async (key) => cards.find((c) => c.key === key) ?? null
    },
    clock: {
      wakeAt: async ({ key, due }) => { wakes.push({ key, due }); return { ref: `wake ${key}` }; },
      drop: async ({ key }) => { drops.push(key); }
    }
  };
}

/** Stub agents by actor name: each finishes with its next queued output; a function output is thrown (fails the run). */
function agents(queues) {
  const left = Object.fromEntries(Object.entries(queues).map(([k, v]) => [k, [v].flat()]));
  return Object.fromEntries(Object.keys(left).map((name) => [name, {
    start: async (effect) => {
      const q = left[name];
      if (!q.length) return { ref: effect.id };
      const next = q.shift();
      if (next instanceof Error) throw next;
      return { ref: effect.id, output: typeof next === 'function' ? next(effect) : next };
    }
  }]));
}

const handlersOf = (w, actors, github = null) => handlers({ github, hearth: w.hearth, clock: w.clock, actors });

/** A tap on a card, in the shape of packages/engine/test/fixtures/wakes/tap-wake.txt, at a time. */
const fixture = (name) => readFileSync(new URL(`../../../packages/engine/test/fixtures/wakes/${name}.txt`, import.meta.url), 'utf8');
const tapWake = (card, index = 0) => fixture('tap-wake')
  .replace(/decision_id=[^<]*/, `decision_id=${card}`).replace(/option_index=[^<]*/, `option_index=${index}`);
/** A real wake (check_suite.completed for another PR, which moves nothing here) at a given current-time. */
const wakeAt = (at) => fixture('check-suite-completed').replace(/current-time="[^"]*"/, `current-time="${at}"`);

/** The transition row that entered `state` most recently. */
const entered = (root, item, state) => rowsOf(root, item)
  .filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && JSON.parse(r.state) === state).at(-1);
const shift = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();

const REPO = new URL('../../../workflows/', import.meta.url).pathname;
const ASKING = { 'quick-fix': ['awaitingGates', 'awaitingMerge', 'blocked', 'replanning'], feature: ['replanning'], research: ['awaitingPublish', 'replanning'] };

test('load-check: the three workflows in workflows/ load', () => {
  for (const name of Object.keys(ASKING)) assert.ok(loadWorkflow(name).id.startsWith(`${name}@`));
  // The three are there, and every workflow in the folder loads.
  const files = readdirSync(REPO).filter((f) => f.endsWith('.json')).sort();
  for (const f of ['feature.json', 'quick-fix.json', 'research.json']) assert.ok(files.includes(f), f);
  for (const f of files) assert.ok(loadWorkflow(f.slice(0, -5)).id.startsWith(`${f.slice(0, -5)}@`), f);
});

for (const [name, states] of Object.entries(ASKING)) {
  for (const state of states) {
    test(`load-check: ${name} with ${state}'s after removed is refused, naming both`, () => {
      const dir = fresh();
      cpSync(REPO, dir, { recursive: true });
      const w = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
      delete w.states[state].after;
      writeFileSync(join(dir, `${name}.json`), JSON.stringify(w, null, 2));
      assert.throws(() => loadWorkflow(name, { dir }), (e) => {
        assert.match(e.message, new RegExp(`^${name}@[0-9a-f]{64}: `), 'names the workflow');
        assert.match(e.message, new RegExp(`state ${state} `), 'names the state');
        return true;
      });
      // And a root given: nothing is pinned for a refused workflow.
      const root = fresh();
      assert.throws(() => loadWorkflow(name, { dir, root }));
      assert.throws(() => readdirSync(join(root, 'blobs')));
    });
  }
}

test('load-check: an after with a delay name missing from meta.delays is refused too', () => {
  const dir = fresh();
  cpSync(REPO, dir, { recursive: true });
  const w = JSON.parse(readFileSync(join(dir, 'quick-fix.json'), 'utf8'));
  w.states.awaitingMerge.after = { nope: {} };
  writeFileSync(join(dir, 'quick-fix.json'), JSON.stringify(w, null, 2));
  assert.throws(() => loadWorkflow('quick-fix', { dir }), /awaitingMerge/);
});

const BRIEFS = { builder: 'b.md', verifier: 'v.md' };
const PLAN_R = { questions: ['q1?', 'q2?', 'q3?'], researcher: 'r', writer: 'w', verifier: 'v' };
const SRC = [{ url: 'https://example.org/a', at: 'quote' }];

/** The one wake this item asked for, checked against the transition that entered `state`. */
function checkOneWake(w, root, item, host, state) {
  const mine = w.wakes.filter((x) => x.key.startsWith(`${item}:`));
  assert.equal(mine.length, 1, `${item}: exactly one wake asked for in ${state}`);
  const row = entered(root, item, state);
  assert.ok(row, `${item} entered ${state}`);
  const [wake] = mine;
  const timers = pending(host).timers;
  assert.equal(timers.length, 1, 'one open timer');
  assert.equal(wake.key, timers[0].id, 'keyed by the timer effect id');
  assert.match(wake.key, new RegExp(`^${item}:${row.payload.seq}\\.xstate\\.after\\.checkBack\\..*\\.${state}$`), 'key is <item>:<seq>.<timer id> of this state');
  assert.equal(Date.parse(wake.due) - Date.parse(row.at), HOUR, 'due one hour after the entering transition');
  assert.equal(timers[0].due, wake.due);
  // The timer effect's rows: start then done, under the entering transition.
  const eff = rowsOf(root, item).filter((r) => r.kind === 'engine.effect' && r.payload.effect === wake.key);
  assert.deepEqual(eff.map((r) => r.payload.phase), ['start', 'done']);
  assert.equal(eff[0].payload.transition, row.id);
  assert.ok(w.cards.some((c) => c.key.startsWith(`${item}:${row.payload.seq}.`) && !c.closed), 'its card is up');
  return wake;
}

test('scheduled: quick-fix awaitingMerge asks for one wake while an independent item advances to its own card', async () => {
  const root = fresh();
  const w = world();
  const one = open(root, 'it-1');
  await offer(one, [start()], handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) })));
  assert.equal(one.snapshot.value, 'awaitingMerge');
  const wake = checkOneWake(w, root, 'it-1', one, 'awaitingMerge');
  // The independent item, beside it in the same journal, advances on its own (briefing -> ... -> its own card).
  const two = open(root, 'it-2');
  await offer(two, [start('owner', { issue: { ...ISSUE, url: 'https://github.com/o/r/issues/8' } })], handlersOf(w, agents({ brief: BRIEFS, build: PR(B), verify: VERDICT(B) })));
  assert.equal(two.snapshot.value, 'awaitingMerge');
  assert.equal(w.cards.filter((c) => c.key.startsWith('it-2:')).length, 1, 'it-2 has its own card');
  assert.equal(w.wakes.filter((x) => x.key.startsWith('it-1:')).length, 1, 'it-1 still one wake');
  assert.equal(one.snapshot.value, 'awaitingMerge', 'it-1 untouched');
  assert.deepEqual(w.drops, []);
  assert.ok(wake);
});

test('scheduled: quick-fix awaitingGates (PASS on a PR changing CI config)', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'g-1');
  await offer(h, [start()], handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A, { gates: ['.github/workflows/ci.yml'] }) })));
  assert.equal(h.snapshot.value, 'awaitingGates');
  checkOneWake(w, root, 'g-1', h, 'awaitingGates');
});

for (const [workflow, input] of [['quick-fix', { issue: ISSUE }], ['feature', { issue: ISSUE, branch: 'feature/x' }], ['research', { issue: ISSUE }]]) {
  test(`scheduled: ${workflow} replanning (the brief run failed)`, async () => {
    const root = fresh();
    const w = world();
    const h = open(root, `rp-${workflow}`, workflow);
    await offer(h, [start('owner', input)], handlersOf(w, agents({ brief: new Error('brief agent failed') })));
    assert.equal(h.snapshot.value, 'replanning');
    checkOneWake(w, root, `rp-${workflow}`, h, 'replanning');
  });
}

test('scheduled: research awaitingPublish (a PASS on the draft)', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'pub-1', 'research');
  const ans = { text: 'a', sources: SRC };
  await offer(h, [start()], handlersOf(w, agents({
    brief: PLAN_R, researcher: [ans, ans, ans], write: { text: 'draft', sources: SRC },
    verify: { result: 'PASS', issue: ISSUE, lines: [{ line: 'x works', result: 'PASS', evidence: 'e' }], sources: SRC }
  })));
  assert.equal(h.snapshot.value, 'awaitingPublish');
  checkOneWake(w, root, 'pub-1', h, 'awaitingPublish');
});

test('scheduled: leaving awaitingMerge by a tap drops the key and leaves no timer open (merging, then done)', async () => {
  const root = fresh();
  const w = world();
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const h = open(root, 'tap-1');
    const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }), gh.client);
    await offer(h, [start()], hs);
    const wake = checkOneWake(w, root, 'tap-1', h, 'awaitingMerge');
    const card = w.cards.find((c) => c.key.startsWith('tap-1:')).ref;
    await offer(h, inputsOfWake(h, tapWake(card, 0), { now: shift(wake.due, -60000) }), hs);
    assert.equal(h.snapshot.value, 'done');
    assert.deepEqual(w.drops, [wake.key], 'the clock was asked to drop exactly that key');
    assert.deepEqual(pending(h).timers, []);
    const cancel = rowsOf(root, 'tap-1').filter((r) => r.kind === 'engine.effect' && r.payload.type === 'cancel');
    assert.deepEqual(cancel.map((r) => r.payload.phase), ['start', 'done']);
    assert.equal(w.wakes.length, 1, 'no new wake asked for in merging or done');
    assert.equal(gh.merges.length, 1);
  } finally {
    await gh.close();
  }
});

test('scheduled: leaving awaitingMerge by a push (fresh item) drops the key and leaves no timer open', async () => {
  const root = fresh();
  const w = world();
  const h = open(root, 'push-1');
  const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }));
  await offer(h, [start()], hs);
  const wake = checkOneWake(w, root, 'push-1', h, 'awaitingMerge');
  await offer(h, [{ event: PUSH(B), source: { system: 'github', ref: 'push b' } }], hs);
  assert.equal(h.snapshot.value, 'verifying');
  assert.deepEqual(w.drops, [wake.key]);
  assert.deepEqual(pending(h).timers, []);
  assert.equal(w.wakes.length, 1, 'verifying sets no timer');
  assert.ok(w.cards.find((c) => c.key.startsWith('push-1:')).closed, 'the card was closed too');
});

const FAR = '2999-01-01T00:00:00Z';

test('fires-holds: before the due time nothing fires; after it the timer row is journalled and the item holds; a tap still moves it', async () => {
  const root = fresh();
  const w = world();
  const gh = await fakeGitHub({ 1: { head: A } });
  try {
    const h = open(root, 'fh-1');
    const hs = handlersOf(w, agents({ brief: BRIEFS, build: PR(A), verify: VERDICT(A) }), gh.client);
    await offer(h, [start()], hs);
    assert.equal(h.snapshot.value, 'awaitingMerge');
    const [timer] = pending(h).timers;
    const askRun = pending(h).runs.find((r) => r.actor === 'ask');
    assert.ok(timer && askRun);
    const before = { rows: rowsOf(root, 'fh-1').length, cards: w.cards.length, wakes: w.wakes.length };

    // A wake one second before the due time, with now far ahead so the clamp does not hide it.
    const early = inputsOfWake(h, wakeAt(shift(timer.due, -1000)), { now: FAR });
    assert.equal(early.filter((i) => i.source.system === 'timer').length, 0, 'no timer input before the due time');
    await offer(h, early, hs);
    assert.equal(rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.source?.system === 'timer').length, 0);
    assert.equal(pending(h).timers.length, 1, 'timer still open');

    // The clamp: a wake claiming a time past due, but with the host's now before due, fires nothing either.
    const clamped = inputsOfWake(h, wakeAt(shift(timer.due, 60000)), { now: shift(timer.due, -1000) });
    assert.equal(clamped.filter((i) => i.source.system === 'timer').length, 0, 'a wake time never runs ahead of the host clock');

    // A wake one second past the due time.
    const late = inputsOfWake(h, wakeAt(shift(timer.due, 1000)), { now: FAR });
    const fired = late.filter((i) => i.source.system === 'timer');
    assert.equal(fired.length, 1);
    assert.deepEqual(fired[0].source, { system: 'timer', ref: timer.id });
    await offer(h, late, hs);
    const trow = rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.source?.system === 'timer');
    assert.equal(trow.length, 1, 'one timer row');
    assert.equal(trow[0].payload.outcome, 'applied', 'the timer event is taken, not refused');
    assert.equal(trow[0].source.ref, timer.id, 'source names the timer effect id');
    assert.equal(trow[0].payload.event.type, timer.event.type);
    assert.equal(JSON.parse(trow[0].state), 'awaitingMerge', 'state unchanged');

    assert.equal(h.snapshot.value, 'awaitingMerge');
    const p = pending(h);
    assert.deepEqual(p.runs.map((r) => r.id), [askRun.id], 'the ask run is still open');
    assert.deepEqual(p.timers, [], 'the fired timer is gone, no new timer');
    assert.deepEqual(p.effects, [], 'nothing pending: no stop, no cancel, no new card');
    assert.equal(w.cards.length, before.cards, 'no new card');
    assert.equal(w.wakes.length, before.wakes, 'no new wake asked for');
    assert.deepEqual(w.closes, [], 'no card closed');
    assert.ok(w.cards.every((c) => !c.closed));
    // No effect row under the timer's transition (no stop, cancel, run or timer).
    assert.deepEqual(rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.effect' && r.payload.transition === trow[0].id), []);

    // A second late wake fires nothing more.
    assert.equal(inputsOfWake(h, wakeAt(shift(timer.due, 5000)), { now: FAR }).filter((i) => i.source.system === 'timer').length, 0);

    // The tap still moves it.
    const card = w.cards.find((c) => c.key === askRun.id).ref;
    await offer(h, inputsOfWake(h, tapWake(card, 0), { now: FAR }), hs);
    // In seq order: the journal reader orders rows by time, and a wake's rows carry the wake's own time.
    const states = rowsOf(root, 'fh-1').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied')
      .sort((x, y) => x.payload.seq - y.payload.seq).map((r) => JSON.parse(r.state));
    assert.deepEqual(states.slice(-3), ['awaitingMerge', 'merging', 'done']);
    assert.equal(h.snapshot.value, 'done');
    assert.equal(gh.merges.length, 1);
  } finally {
    await gh.close();
  }
});
