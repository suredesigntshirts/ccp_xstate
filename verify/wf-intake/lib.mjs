// Helpers for the wf-intake verifier's own tests. Written from plan/items/wf-intake.md, the decision
// (plan/decisions/2026-11-05-wf-intake-ready.md), workflows/intake.json and the engine's src; the builder's
// packages/engine/test/intake.test.js is not read. The engine is real: loadWorkflow (the load check), restore, offer,
// pump with the real handlers (a workflow invoke starts a real child item through effects/item.js), and the real agent
// run handler (prepare, spawn, bind, accept) for intake's two stages. Agents are stubs: each returns a result through
// accept(), as the harness return tool does. The quick-fix child's stages are either real runs (prepared, left open)
// or stubs that finish at once, so the child can end.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../packages/engine/src/host.js';
import { actors, accept, bind, spawn, loadRun, runDir } from '../../packages/engine/src/actors.js';
import { handlers, pump } from '../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export { pending, loadRun, runDir, accept };
export const SESSION = 'owner';
export const RELEASE = '0.2.0';
export const ITEM = 'in-1';
export const REQUEST = { url: 'https://github.com/o/tally/issues/9', text: 'tally prints totals with float noise (0.30000000000000004). Round totals to two decimals.' };

/** A shaped issue, as shape returns it (no url). `n` makes versions differ. */
export const ISSUE = (n = 1, extra = {}) => ({
  title: `Round printed totals (v${n})`,
  problem: 'tally sum 0.1 0.2 prints 0.30000000000000004.',
  reason: 'Totals are read by people.',
  outcome: 'Printed totals have at most two decimals.',
  expect: [`tally sum 0.1 0.2 prints 0.3 (v${n})`, 'npm test passes'],
  proofs: [
    { line: `tally sum 0.1 0.2 prints 0.3 (v${n})`, proof: 'run', how: 'node bin/tally.js sum 0.1 0.2' },
    { line: 'npm test passes', proof: 'ci', how: 'the test check' }
  ],
  non_goals: ['no change to the library'],
  assumptions: ['two decimals means rounding half up'],
  ...extra
});
/** A challenge verdict covering `issue.expect`: result PASS, or FAIL on the first line. */
export const VERDICT = (issue, result = 'PASS', tag = '') => ({
  result,
  lines: issue.expect.map((line, i) => ({
    line,
    result: result === 'FAIL' && i === 0 ? 'FAIL' : 'PASS',
    evidence: result === 'FAIL' && i === 0 ? `a build rounding only sum meets it ${tag}` : `tried a wrong build ${tag}`
  })),
  wrong_build: `rounding only the sum command ${tag}`
});

const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];
export const tmp = (name) => mkdtempSync(join(tmpdir(), `vwi-${name}-`));
export function repoWithCommit() {
  const repo = tmp('repo');
  execFileSync('git', ['init', '-q', '-b', 'main', repo]);
  execFileSync('git', ['-C', repo, ...ID, 'commit', '-q', '--allow-empty', '-m', 'base']);
  return repo;
}

/**
 * A world over the real engine. Intake's shape and challenge are real agent runs (run folders, prompts); ask is a
 * stub that puts a card up and stays open (`tap` answers it). The quick-fix child's brief/build/verify are real
 * open runs when `childReal`, else stubs that finish at once with the queued outputs; its ask (the merge card) is
 * answered approve at once and merge returns a sha.
 */
export function world({ childReal = false } = {}) {
  const root = tmp('root');
  const repo = repoWithCommit();
  const worktrees = join(root, 'wt');
  const log = [];
  let cards = 0;
  let taps = 0;
  const stub = (name, fn) => ({ start: async (effect) => { log.push(effect); return fn(effect); } });
  const childStubs = {
    brief: stub('brief', () => ({ output: { builder: 'build it', verifier: 'verify it' } })),
    build: stub('build', () => ({ output: { pr: { url: 'https://github.com/o/tally/pull/3', at: 'a'.repeat(40), key: 'o/tally#3', green: true } } })),
    verify: stub('verify', (e) => ({ output: {
      result: 'PASS', pr: { url: 'https://github.com/o/tally/pull/3', at: 'a'.repeat(40) }, issue: e.input.issue,
      lines: e.input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: 'stub' }))
    } })),
    ask: stub('ask', () => ({ output: { choice: 'approve', by: 'stand-in' } })),
    merge: stub('merge', () => ({ output: { sha: 'd'.repeat(40) } }))
  };
  const intakeAsk = { ask: stub('ask', (e) => ({ ref: `card-${++cards}` })) };
  const w = {
    root, repo, worktrees, log,
    handlersFor: (host) => {
      const isChild = String(host.spec.id).startsWith('quick-fix@');
      const own = isChild
        ? (childReal ? { ...actors({ host, repo, worktrees }), ask: childStubs.ask, merge: childStubs.merge } : childStubs)
        : { ...actors({ host, repo, worktrees }), ...intakeAsk };
      return handlers({ github: null, host, workflows: ['quick-fix'], handlersFor: w.handlersFor, actors: own });
    },
    host: (item = ITEM) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (input = { request: REQUEST }, item = ITEM) => {
      const host = restore({ root, item, spec: loadWorkflow('intake', { root }), session: SESSION, release: RELEASE });
      const results = await offer(host, [{ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
      return results;
    },
    drive: (top = ITEM) => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor }),
    rows: (item = ITEM) => readFile(itemFile(root, item)).rows,
    state: (item = ITEM) => w.host(item).snapshot.value,
    status: (item = ITEM) => w.host(item).snapshot.status,
    openRun: (actor, item = ITEM) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** The open run of `actor` returns `result` through the real spawn/bind/accept; then the item is driven. */
    agent: async (actor, result, { item = ITEM, drive = true } = {}) => {
      const run = w.openRun(actor, item);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const value = typeof result === 'function' ? result(loadRun(root, run.id)) : result;
      const got = await accept({ root, caller: id, run: run.id, result: value, toolUseId: `tu_${id}_ret`, github: null });
      if (drive) await w.drive();
      return { run, got };
    },
    /** Answer the open card of `item` with `output` (a tap), then drive. */
    tap: async (output, item = ITEM) => {
      const host = w.host(item);
      const run = pending(host).runs.find((r) => r.actor === 'ask');
      if (!run) throw new Error(`no open card on ${item}`);
      const res = await offer(host, [{ event: { type: 'xstate.done.actor.ask', output }, run: run.id, source: { system: 'hearth', ref: `tap ${run.id} ${++taps}` } }], w.handlersFor(host));
      await w.drive();
      return res;
    },
    /** Runs of `actor` prepared on `item`, in order, as run.json. */
    runs: (actor, item = ITEM) => w.rows(item)
      .filter((r) => r.kind === 'brief.stored' && r.payload.actor === actor && r.payload.role === actor)
      .map((r) => loadRun(root, r.payload.run)),
    /** Child items started by `item` (effects of the quick-fix actor). */
    children: (item = ITEM) => w.rows(item)
      .filter((r) => r.kind === 'engine.effect' && r.payload.actor === 'quick-fix' && r.payload.phase === 'start')
      .map((r) => r.payload.effect)
  };
  return w;
}

export const read = (path) => readFileSync(path, 'utf8');
