// Verifier's driver for plan item run-lifecycle-store, written from the item's Expect lines and main's actors.js; the
// builder's tests are not used. It drives one checkout's engine (its packages/engine/src) through every hook a run
// meets, in fixed temp paths and with a git repo committed at a fixed date, so two checkouts write the same bytes
// apart from times. Each step records the hook's return, every run-folder and pointer file that changed, and the
// journal rows it added; `at`, `id` and the hook session are taken out.
//
//   node verify/run-lifecycle-store/scenario.mjs <checkout> <out-dir>
//
// writes <out-dir>/trace.json, <out-dir>/states/<scenario>/<milestone>/ (the lifecycle files of every run folder and
// the pointer files, as the checkout's engine left them) and <out-dir>/pre/ (a whole root that main leaves with
// refusals and stall rows already spent, for the continuation in one-budget).
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const BASE = join(tmpdir(), 'verify-rls');
export const LIFECYCLE = ['run.json', 'spawn.json', 'agent.json', 'result.json', 'failed.json', 'sent-back.json'];
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x'] };
const BRIEFS = { builder: 'verify-rls builder brief', verifier: 'verify-rls verifier brief' };
const SESSION = 's';

export async function engineOf(checkout) {
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
export function lifecycleFiles(root) {
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
  const spec = E.loadWorkflow('quick-fix');
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

export const SCENARIOS = {
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

// The continuation: v-1's run bound with 7 counted refusals, v-2's run prepared with one stall block, as main leaves them.
export async function pre(E, r) {
  await start(E, r, 'v-1:0.brief', 'ag');
  for (let i = 1; i <= 7; i++) await r.call(`refuse ${i}`, () => E.accept({ root: r.root, caller: 'ag', run: 'v-1:0.brief', result: {}, toolUseId: `p${i}`, github: null, session: SESSION }));
  // Only v-2 waits now, so the Stop blocks it.
  await r.call('stall 1', () => E.stall({ root: r.root, sessions: [SESSION], session: SESSION }));
}
export async function cont(E, root) {
  const out = [];
  const call = async (label, fn) => out.push({ label, ret: strip(await fn()) });
  for (let i = 8; i <= 11; i++) await call(`refuse ${i}`, () => E.accept({ root, caller: 'ag', run: 'v-1:0.brief', result: {}, toolUseId: `c${i}`, github: null, session: SESSION }));
  for (let i = 2; i <= 4; i++) await call(`stall ${i}`, () => E.stall({ root, sessions: [SESSION], session: SESSION }));
  return out;
}

/** actors.js's exports: { name: { type, value } }, the value of each that is not a function (a RegExp as its source). */
export async function exportsOf(checkout) {
  const m = await import(pathToFileURL(join(resolve(checkout), 'packages/engine/src/actors.js')).href);
  return Object.fromEntries(Object.keys(m).sort().map((k) => {
    const v = m[k];
    const type = v instanceof RegExp ? 'regexp' : Array.isArray(v) ? 'array' : typeof v;
    return [k, type === 'function' ? { type } : { type, value: type === 'regexp' ? String(v) : v }];
  }));
}

export async function record(checkout, out) {
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
  cpSync(p.root, join(out, 'pre'), { recursive: true });
  trace.cont = await cont(E, p.root);
  writeFileSync(join(out, 'trace.json'), `${JSON.stringify(trace, null, 1)}\n`);
  return trace;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [checkout, out] = process.argv.slice(2);
  await record(checkout, resolve(out));
  console.log(`recorded ${checkout} -> ${out}`);
}
