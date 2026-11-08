// Expect: run-lifecycle-store/states-true, run-lifecycle-store/one-budget, run-lifecycle-store/answers-unchanged
// The run lifecycle store, driven through every hook on scripted runs that reach each end state and failure kind:
// store.state reads each run folder as the state that made it and as an independent reading of its files would, a
// transition from a state it does not leave from writes nothing, the hooks are called in every state they can see, the
// attempts in run.json count every counted refusal, send-back and stall block, the run fails at the cap BUDGET names,
// and a run folder written before attempts existed continues from the journal's counts.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATES, TRANSITIONS, state, transition, BUDGET, spent } from '../../../packages/engine/src/run/store.js';
import { REFUSAL_CAP } from '../../../packages/engine/src/run/accept.js';
import { STALL_CAP } from '../../../packages/engine/src/run/supervise.js';

const BASE = join(tmpdir(), `regression-rls-${process.pid}`);
const LIFECYCLE = ['run.json', 'spawn.json', 'agent.json', 'result.json', 'failed.json', 'sent-back.json'];
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x'] };
const BRIEFS = { builder: 'verify-rls builder brief', verifier: 'verify-rls verifier brief' };
const SESSION = 's';

async function engineOf(checkout) {
  const at = (p) => import(pathToFileURL(join(resolve(checkout), p)).href);
  const [index, effects, actors] = await Promise.all([at('packages/engine/src/index.js'), at('packages/engine/src/effects/index.js'), at('packages/engine/src/actors.js')]);
  return { ...index, handlers: effects.handlers, ...actors };
}

// Times, row ids and hook sessions differ between runs; everything else must not.
const strip = (value) => JSON.parse(JSON.stringify(value ?? null, (k, v) => (k === 'at' || k === 'id' || k === 'hookSession' ? undefined : v)));

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

/** Every lifecycle file of every run folder and every pointer file under root: { relative path: parsed JSON }. */
function lifecycleFiles(root) {
  const out = {};
  for (const p of walk(join(root, 'items'))) if (p.includes(`${join('runs', '')}`) && LIFECYCLE.some((f) => p.endsWith(`/${f}`))) out[relative(root, p)] = JSON.parse(readFileSync(p, 'utf8'));
  for (const p of walk(join(root, 'actors'))) out[relative(root, p)] = JSON.parse(readFileSync(p, 'utf8'));
  return out;
}

// The journal rows as written (not upcast), by item file.
function rawRows(root) {
  const dir = join(root, 'items');
  if (!existsSync(dir)) return {};
  return Object.fromEntries(readdirSync(dir).filter((n) => n.endsWith('.jsonl')).sort().map((n) => [n, readFileSync(join(dir, n), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))]));
}
// The rows added since `before` (rawRows), file by file in name order.
const added = (before, now) => Object.entries(now).flatMap(([n, rows]) => rows.slice(before[n]?.length ?? 0));

function gitRepo(dir) {
  mkdirSync(dir, { recursive: true });
  const env = { ...process.env, GIT_AUTHOR_DATE: '2026-01-01T00:00:00Z', GIT_COMMITTER_DATE: '2026-01-01T00:00:00Z', GIT_CONFIG_GLOBAL: '/dev/null' };
  execFileSync('git', ['init', '-q', '-b', 'main', dir], { env });
  writeFileSync(join(dir, 'f.txt'), 'x\n');
  execFileSync('git', ['-C', dir, 'add', '-A'], { env });
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'one'], { env });
  return dir;
}

/**
 * A fresh root at BASE/<name> with items started by `session`, each with its brief run prepared and waiting. The
 * recorder `r` logs each call: r.call(label, fn) runs fn, keeps its return and what changed.
 */
async function world(E, name, items = ['v-1']) {
  const base = join(BASE, name);
  rmSync(base, { recursive: true, force: true });
  const root = join(base, 'root');
  const repo = gitRepo(join(base, 'repo'));
  const spec = E.loadWorkflow('quick-fix', { root });
  const hosts = {};
  for (const item of items) {
    const host = E.restore({ root, item, spec, session: SESSION, release: '0.2.0' });
    await E.offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: SESSION } }], E.handlers({ actors: E.actors({ host, repo, worktrees: join(base, 'wt') }) }));
    hosts[item] = host;
  }
  const steps = [];
  let files = lifecycleFiles(root);
  let rows = rawRows(root);
  const r = {
    root, base, spec, hosts, steps,
    async call(label, fn) {
      const ret = await fn();
      const now = lifecycleFiles(root);
      // run.json's attempts are the one field the item adds; they are kept apart, per run folder, after each step.
      const attempts = {};
      const bare = (k, v) => {
        if (!v || !k.endsWith('/run.json')) return v;
        const { attempts: a, ...rest } = v;
        if (a !== undefined) attempts[k] = a;
        return rest;
      };
      const before = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, JSON.stringify(bare(k, v))]));
      const changed = {};
      for (const [k, v] of Object.entries(now)) if (JSON.stringify(bare(k, v)) !== before[k]) changed[k] = bare(k, v);
      for (const k of Object.keys(files)) if (!(k in now)) changed[k] = null;
      const all = rawRows(root);
      steps.push({ label, ret: strip(ret), changed: strip(changed), rows: strip(added(rows, all)), attempts });
      files = now;
      rows = all;
      return ret;
    }
  };
  return r;
}

const host = (r, item) => ({ root: r.root, spec: r.spec, runs: r.hosts[item].runs });

// The hooks a run can see, in each state, called the same way at both shas.
function probes(E, r, run, item, agent = 'ag', tag = '') {
  return [
    // A spawn would start a prepared run, so the prepared state is probed by every hook but spawn; the scenario's own
    // spawn step is the call in that state.
    ...(tag === 'prepared' ? [] : [['spawn', () => E.spawn({ root: r.root, prompt: `ccp-run ${run}`, toolUseId: 'probe-tu', session: SESSION })]]),
    ['cannotStart', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: probe`, sessions: ['other'], session: SESSION })],
    ['accept-wrong', () => E.accept({ root: r.root, caller: 'impostor', run, result: {}, toolUseId: 'probe-acc', github: null, session: SESSION })],
    ['waiting', () => E.waiting(r.root, item)],
    ['ownedWaiting', () => E.ownedWaiting(r.root, [SESSION])],
    ['startedRun', () => E.startedRun({ root: r.root, session: SESSION })],
    ['resultsOf', () => E.resultsOf(host(r, item))],
    ['boundRun', () => E.boundRun(r.root, agent)]
  ];
}
async function probe(E, r, tag, run, item, agent) {
  for (const [name, fn] of probes(E, r, run, item, agent, tag)) await r.call(`${tag}: ${name}`, fn);
}

// Copies the lifecycle files (and pointers) of a root, for states-true.
function keep(r, out, scenario, milestone) {
  const dest = join(out, 'states', scenario, milestone);
  for (const [rel, v] of Object.entries(lifecycleFiles(r.root))) {
    mkdirSync(join(dest, rel, '..'), { recursive: true });
    writeFileSync(join(dest, rel), `${JSON.stringify(v, null, 2)}\n`);
  }
}

const start = async (E, r, run, agent, tu = `tu-${agent}`) => {
  await r.call(`spawn ${run}`, () => E.spawn({ root: r.root, prompt: `ccp-run ${run}`, toolUseId: tu, session: SESSION }));
  await r.call(`bind ${agent}`, () => E.bind({ root: r.root, agentId: agent, toolUseId: tu, agentType: 'general-purpose', session: SESSION, via: 'start' }));
};

const SCENARIOS = {
  // prepared -> spawned -> bound -> returned, every hook probed in each state.
  async returned(E, r, out) {
    const run = 'v-1:0.brief';
    keep(r, out, 'returned', 'prepared');
    await probe(E, r, 'prepared', run, 'v-1');
    await r.call('accept unbound', () => E.accept({ root: r.root, caller: 'ag', run, result: BRIEFS, toolUseId: 'a0', github: null, session: SESSION }));
    await r.call('spawn', () => E.spawn({ root: r.root, prompt: `ccp-run ${run}`, toolUseId: 'tu-ag', session: SESSION }));
    keep(r, out, 'returned', 'spawned');
    await probe(E, r, 'spawned', run, 'v-1');
    await r.call('bind wrong call', () => E.bind({ root: r.root, agentId: 'ag', toolUseId: 'tu-none', session: SESSION }));
    await r.call('bind', () => E.bind({ root: r.root, agentId: 'ag', toolUseId: 'tu-ag', agentType: 'general-purpose', session: SESSION, via: 'start' }));
    await r.call('bind again', () => E.bind({ root: r.root, agentId: 'ag2', toolUseId: 'tu-ag', session: SESSION }));
    await r.call('bindLate mismatch', () => E.bindLate({ root: r.root, agentId: 'ag', metaToolUseId: 'tu-other', session: SESSION }));
    await r.call('bindLate verify', () => E.bindLate({ root: r.root, agentId: 'ag', metaToolUseId: 'tu-ag', session: SESSION }));
    await r.call('bindLate verified', () => E.bindLate({ root: r.root, agentId: 'ag', metaToolUseId: 'tu-other', session: SESSION }));
    keep(r, out, 'returned', 'bound');
    await probe(E, r, 'bound', run, 'v-1');
    await r.call('accept main session', () => E.accept({ root: r.root, caller: null, run, result: BRIEFS, toolUseId: 'a1', github: null, session: SESSION }));
    await r.call('accept unknown run', () => E.accept({ root: r.root, caller: 'ag', run: 'v-1:9.none', result: BRIEFS, toolUseId: 'a2', github: null, session: SESSION }));
    await r.call('accept restated', () => E.accept({ root: r.root, caller: 'ag', run, result: { ...BRIEFS, issue: { url: 'https://github.com/o/r/issues/8', expect: ['x'] } }, toolUseId: 'a3', github: null, session: SESSION }));
    await r.call('accept', () => E.accept({ root: r.root, caller: 'ag', run, result: BRIEFS, toolUseId: 'a4', github: null, session: SESSION }));
    await r.call('accept again', () => E.accept({ root: r.root, caller: 'ag', run, result: BRIEFS, toolUseId: 'a5', github: null, session: SESSION }));
    await r.call('handback returned', () => E.handback({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('stopped returned', () => E.stopped({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('stall returned', () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
    keep(r, out, 'returned', 'returned');
    await probe(E, r, 'returned', run, 'v-1', 'ag');
  },
  // Ten counted refusals fail the run at the tenth.
  async 'refusal-cap'(E, r, out) {
    const run = 'v-1:0.brief';
    await start(E, r, run, 'ag');
    for (let i = 1; i <= 10; i++) await r.call(`refuse ${i}`, () => E.accept({ root: r.root, caller: 'ag', run, result: i % 2 ? {} : { builder: 1 }, toolUseId: `r${i}`, github: null, session: SESSION }));
    await r.call('accept after cap', () => E.accept({ root: r.root, caller: 'ag', run, result: BRIEFS, toolUseId: 'r11', github: null, session: SESSION }));
    await r.call('handback failed', () => E.handback({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('stopped failed', () => E.stopped({ root: r.root, agentId: 'ag', session: SESSION }));
    await probe(E, r, 'failed', run, 'v-1', 'ag');
    keep(r, out, 'refusal-cap', 'failed');
  },
  // SubagentStop: sent back once, then failed (no-return).
  async 'no-return-stop'(E, r, out) {
    const run = 'v-1:0.brief';
    await start(E, r, run, 'ag');
    await r.call('stopped 1', () => E.stopped({ root: r.root, agentId: 'ag', session: SESSION }));
    keep(r, out, 'no-return-stop', 'sent-back');
    await r.call('stopped 2', () => E.stopped({ root: r.root, agentId: 'ag', again: true, session: SESSION }));
    await r.call('stopped 3', () => E.stopped({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('accept failed', () => E.accept({ root: r.root, caller: 'ag', run, result: BRIEFS, toolUseId: 'x', github: null, session: SESSION }));
    await probe(E, r, 'failed', run, 'v-1', 'ag');
    keep(r, out, 'no-return-stop', 'failed');
  },
  // SubagentStop with stop_hook_active on the first stop: no send-back is spent, the run fails at once.
  async 'no-return-again'(E, r, out) {
    const run = 'v-1:0.brief';
    await start(E, r, run, 'ag');
    await r.call('stopped again', () => E.stopped({ root: r.root, agentId: 'ag', again: true, session: SESSION }));
    keep(r, out, 'no-return-again', 'failed');
  },
  // SubagentHandback: denied once, then failed; a stop after it is nothing.
  async 'no-return-handback'(E, r, out) {
    const run = 'v-1:0.brief';
    await start(E, r, run, 'ag');
    await r.call('handback 1', () => E.handback({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('stopped after handback deny', () => E.stopped({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('handback 2', () => E.handback({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('handback 3', () => E.handback({ root: r.root, agentId: 'ag', session: SESSION }));
    await r.call('handback stranger', () => E.handback({ root: r.root, agentId: 'nobody', session: SESSION }));
    keep(r, out, 'no-return-handback', 'failed');
  },
  // A stop after a handback fails the run at once.
  async 'no-return-handed-back'(E, r, out) {
    const run = 'v-1:0.brief';
    await start(E, r, run, 'ag');
    await r.call('stopped handedBack', () => E.stopped({ root: r.root, agentId: 'ag', handedBack: true, session: SESSION }));
    keep(r, out, 'no-return-handed-back', 'failed');
  },
  // The owner's Stop is blocked twice, then the run fails (stall-cap); other sessions see nothing.
  async 'stall-cap'(E, r, out) {
    const run = 'v-1:0.brief';
    await r.call('stall other', () => E.stall({ root: r.root, sessions: ['other'], session: 'other' }));
    for (let i = 1; i <= 4; i++) await r.call(`stall ${i}`, () => E.stall({ root: r.root, sessions: [SESSION, null], session: SESSION }));
    await probe(E, r, 'failed', run, 'v-1');
    keep(r, out, 'stall-cap', 'failed');
  },
  // Two items waiting: one Stop blocks the first and passes over the second.
  async 'stall-two'(E, r, out) {
    for (let i = 1; i <= 4; i++) await r.call(`stall ${i}`, () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
    keep(r, out, 'stall-two', 'end');
  },
  // ccp-cannot-start: refused without a reason, for others and unknown runs; the owner's fails the run.
  async 'cannot-start'(E, r, out) {
    const run = 'v-1:0.brief';
    await r.call('no reason', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: <why>`, sessions: [SESSION], session: SESSION }));
    await r.call('bad form', () => E.cannotStart({ root: r.root, prompt: 'ccp-cannot-start nonsense', sessions: [SESSION], session: SESSION }));
    await r.call('unknown', () => E.cannotStart({ root: r.root, prompt: 'ccp-cannot-start v-1:5.build: x', sessions: [SESSION], session: SESSION }));
    await r.call('other session', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: x`, sessions: ['other'], session: 'other' }));
    await r.call('not ours', () => E.cannotStart({ root: r.root, prompt: 'hello', sessions: [SESSION], session: SESSION }));
    await r.call('owner', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: no Agent tool here`, sessions: [SESSION], session: SESSION }));
    await r.call('owner again', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: again`, sessions: [SESSION], session: SESSION }));
    await r.call('spawn failed', () => E.spawn({ root: r.root, prompt: `ccp-run ${run}`, toolUseId: 'tu-late', session: SESSION }));
    await r.call('stall failed', () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
    keep(r, out, 'cannot-start', 'failed');
  },
  // ccp-cannot-start after the run's Agent call, and after its agent is bound.
  async 'cannot-start-started'(E, r, out) {
    const run = 'v-1:0.brief';
    await r.call('spawn', () => E.spawn({ root: r.root, prompt: `ccp-run ${run}`, toolUseId: 'tu-ag', session: SESSION }));
    await r.call('cannot spawned', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: x`, sessions: [SESSION], session: SESSION }));
    await r.call('startedRun', () => E.startedRun({ root: r.root, session: SESSION }));
    await r.call('bind', () => E.bind({ root: r.root, agentId: 'ag', toolUseId: E.startedRun({ root: r.root, session: SESSION }), session: SESSION, via: 'start' }));
    await r.call('cannot bound', () => E.cannotStart({ root: r.root, prompt: `ccp-cannot-start ${run}: x`, sessions: [SESSION], session: SESSION }));
    await r.call('stall bound', () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
    keep(r, out, 'cannot-start-started', 'bound');
  }
};
const ITEMS = { 'stall-two': ['v-1', 'v-2'] };

// The continuation: v-1's run bound with 7 counted refusals, v-2's run prepared with one stall block.
async function pre(E, r) {
  await start(E, r, 'v-1:0.brief', 'ag');
  for (let i = 1; i <= 7; i++) await r.call(`refuse ${i}`, () => E.accept({ root: r.root, caller: 'ag', run: 'v-1:0.brief', result: {}, toolUseId: `p${i}`, github: null, session: SESSION }));
  // Only v-2 waits now, so the Stop blocks it.
  await r.call('stall 1', () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
}
async function cont(E, root) {
  const out = [];
  const call = async (label, fn) => out.push({ label, ret: strip(await fn()) });
  for (let i = 8; i <= 11; i++) await call(`refuse ${i}`, () => E.accept({ root, caller: 'ag', run: 'v-1:0.brief', result: {}, toolUseId: `c${i}`, github: null, session: SESSION }));
  for (let i = 2; i <= 4; i++) await call(`stall ${i}`, () => E.stall({ root, sessions: [SESSION], session: SESSION }));
  return out;
}

// A root as one JSON file ({ relative path: text }), so repo-wide scans of committed journals (items/*.jsonl) do not
// take this evidence for a finished item's journal; unpack writes it back.
const pack = (root) => Object.fromEntries(walk(root).sort().map((p) => [relative(root, p), readFileSync(p, 'utf8')]));
function unpack(files, root) {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), text);
  }
}

/** actors.js's exports: { name: { type, value } }, the value of each that is not a function (a RegExp as its source). */
async function exportsOf(checkout) {
  const m = await import(pathToFileURL(join(resolve(checkout), 'packages/engine/src/actors.js')).href);
  return Object.fromEntries(Object.keys(m).sort().map((k) => {
    const v = m[k];
    const type = v instanceof RegExp ? 'regexp' : Array.isArray(v) ? 'array' : typeof v;
    return [k, type === 'function' ? { type } : { type, value: type === 'regexp' ? String(v) : v }];
  }));
}

async function record(checkout, out) {
  const E = await engineOf(checkout);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'exports.json'), `${JSON.stringify(await exportsOf(checkout), null, 1)}\n`);
  const trace = {};
  for (const [name, fn] of Object.entries(SCENARIOS)) {
    const r = await world(E, name, ITEMS[name]);
    await fn(E, r, out);
    trace[name] = r.steps;
  }
  const p = await world(E, 'pre', ['v-1', 'v-2']);
  await pre(E, p);
  trace.pre = p.steps;
  writeFileSync(join(out, 'pre.json'), `${JSON.stringify(pack(p.root), null, 1)}\n`);
  trace.cont = await cont(E, p.root);
  writeFileSync(join(out, 'trace.json'), `${JSON.stringify(trace, null, 1)}\n`);
  return trace;
}


const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..', '..');
const OUT = mkdtempSync(join(tmpdir(), 'regression-rls-'));
const head = await record(REPO, OUT);
// The lifecycle files of each run folder, kept at each milestone of the scripted runs above.
const KEPT = join(OUT, 'states');
const RUN = 'v-1:0.brief';

// What each milestone is, from the hook that made it (scenario.mjs), not from the store.
const EXPECTED = {
  'returned/prepared': 'prepared', 'returned/spawned': 'spawned', 'returned/bound': 'bound', 'returned/returned': 'returned',
  'refusal-cap/failed': 'failed', 'no-return-stop/sent-back': 'bound', 'no-return-stop/failed': 'failed',
  'no-return-again/failed': 'failed', 'no-return-handback/failed': 'failed', 'no-return-handed-back/failed': 'failed',
  'stall-cap/failed': 'failed', 'cannot-start/failed': 'failed', 'cannot-start-started/bound': 'bound'
};
// Why each failed: the start of failed.json's why.
const WHY = {
  'refusal-cap/failed': 'refused 10 times', 'no-return-stop/failed': 'the actor ended (SubagentStop)', 'no-return-again/failed': 'the actor ended (SubagentStop)',
  'no-return-handback/failed': 'the actor ended (SubagentStop)', 'no-return-handed-back/failed': 'the actor ended (SubagentStop, after a handback)', 'stall-cap/failed': 'stalled',
  'cannot-start/failed': 'cannot-start'
};

const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? files(join(dir, n)) : [join(dir, n)]));
const bytes = (root) => Object.fromEntries(existsSync(root) ? files(root).map((p) => [relative(root, p), readFileSync(p, 'utf8')]) : []);

test('states-true: the run folders the scripted runs leave, one per end state and failure kind, read as the state that made them', () => {
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

// The run's state read from its files alone: spawn() denies failed before started; accept() takes result before failed; a run folder
// with spawn.json and no agent.json is a started Agent call.
function filesState(dir) {
  const has = (f) => existsSync(join(dir, f));
  if (!has('run.json')) return null;
  if (has('result.json')) return 'returned';
  if (has('failed.json')) return 'failed';
  if (has('agent.json')) return 'bound';
  if (has('spawn.json')) return 'spawned';
  return 'prepared';
}

test('states-true: every committed run folder under bench/brief/runs reads as an independent reading of its files does', () => {
  const found = [];
  for (const top of ['bench/brief/runs']) {
    for (const p of files(join(REPO, top)).filter((p) => p.endsWith('/run.json') && p.includes('/items/') && p.includes('/runs/'))) {
      const dir = dirname(p);
      const parts = dir.split('/');
      const i = parts.lastIndexOf('items');
      const root = parts.slice(0, i).join('/');
      const id = `${parts[i + 1]}:${parts[i + 3]}`;
      found.push([relative(REPO, dir), state(root, id), filesState(dir)]);
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

const RESULT_RULES = ['schema', 'reserved', 'restated', 'covers', 'ref'];


test('answers-unchanged: the hooks named in the Expect line are all called, in each state they can see', () => {
  const labels = Object.values(head).flat().map((s) => s.label).join('\n');
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
});

test('one-budget: the run fails at its cap (10th refusal, the end after a send-back, 3rd Stop)', () => {
  const failAt = (steps) => steps.find((s) => Object.keys(s.changed).some((k) => k.endsWith('failed.json')))?.label;
  for (const [name, at] of [['refusal-cap', 'refuse 10'], ['no-return-stop', 'stopped 2'], ['no-return-handback', 'stopped after handback deny'], ['no-return-again', 'stopped again'], ['no-return-handed-back', 'stopped handedBack'], ['stall-cap', 'stall 3'], ['stall-two', 'stall 3']]) {
    assert.equal(failAt(head[name]), at, `head ${name}`);
  }
  const last = head['refusal-cap'].find((s) => s.label === 'refuse 10');
  assert.equal(last.ret.failed, 'v-1:0.brief');
  assert.deepEqual(last.ret.fix.count, 10);
  assert.deepEqual(last.attempts['items/v-1/runs/0.brief/run.json'], { refused: 10 });
});


test('one-budget: BUDGET is { refused: 10, sentBack: 1, stalled: 2 } and the caps are read from it', () => {
  assert.deepEqual({ ...BUDGET }, { refused: 10, sentBack: 1, stalled: 2 });
  assert.ok(Object.isFrozen(BUDGET));
  assert.equal(REFUSAL_CAP, BUDGET.refused);
  assert.equal(STALL_CAP, BUDGET.stalled);
});

test('one-budget: a root left with 7 refusals and 1 stall block and no attempts in run.json continues from the journal\'s counts', async () => {
  const root = join(tmpdir(), `verify-rls-cont-${process.pid}`, 'root');
  rmSync(dirname(root), { recursive: true, force: true });
  unpack(JSON.parse(readFileSync(join(OUT, 'pre.json'), 'utf8')), root);
  // The shape a run folder had before run.json counted attempts.
  for (const item of ['v-1', 'v-2']) {
    const f = join(root, 'items', item, 'runs', '0.brief', 'run.json');
    const { attempts, ...rest } = JSON.parse(readFileSync(f, 'utf8'));
    writeFileSync(f, JSON.stringify(rest));
  }
  const runJson = (item) => JSON.parse(readFileSync(join(root, 'items', item, 'runs', '0.brief', 'run.json'), 'utf8'));
  assert.equal(runJson('v-1').attempts, undefined);
  assert.equal(runJson('v-2').attempts, undefined);
  // The hooks pass spent() the run's record; the journal fallback reads its item and run from it.
  assert.equal(spent(root, runJson('v-1'), 'refused'), 7);
  assert.equal(spent(root, runJson('v-2'), 'stalled'), 1);
  assert.equal(spent(root, runJson('v-1'), 'sentBack'), 0);
  const E = await engineOf(REPO);
  const got = await cont(E, root);
  // refuse 8, 9 count on; 10 fails the run; 11 is already-failed. Stall 2 blocks, 3 fails, 4 is nothing.
  assert.deepEqual(got.map((s) => [s.label, s.ret?.fix?.count ?? null, s.ret?.failed ?? null]).slice(0, 4), [['refuse 8', 8, null], ['refuse 9', 9, null], ['refuse 10', 10, 'v-1:0.brief'], ['refuse 11', null, null]]);
  assert.match(got[1 + 3].ret.block, /Block 2 of 2\./);
  assert.deepEqual(got[5].ret.failed, ['v-2:0.brief']);
  assert.equal(got[6].ret, null);
  assert.deepEqual(runJson('v-1').attempts, { refused: 10 });
  assert.deepEqual(runJson('v-2').attempts, { stalled: 2 });
  const listed = readdirSync(join(root, 'items', 'v-1', 'runs', '0.brief')).sort();
  assert.ok(listed.includes('failed.json'), listed.join());
});
