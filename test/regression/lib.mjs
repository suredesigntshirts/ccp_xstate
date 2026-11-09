// What two or more regression tests share: a quick-fix item driven by the real host with stub agents, the effect
// agents that finish with queued outputs, and the shapes of the results and wakes those tests offer it.
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, inputsOfWake, loadWorkflow, itemFile } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export const A = 'a'.repeat(40);
export const B = 'b'.repeat(40);
const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x works'] };
export const BRIEFS = { builder: 'b.md', verifier: 'v.md' };
// A PR is a ref { url, at }, handed to the item as the host stamps it at accept (key, and green when CI was green on
// at); a verdict restates the PR and the issue and gives one
// line per expect line. A push is CI green on the PR at its new head.
export const PR = (sha) => ({ pr: { url: 'https://github.com/o/r/pull/1', at: sha, key: 'o/r#1', green: true } });
export const VERDICT = (result, sha, issue = ISSUE) => ({ result, pr: { url: 'https://github.com/o/r/pull/1', at: sha }, issue, lines: issue.expect.map((line) => ({ line, result, evidence: 'e' })) });

/**
 * A working clone of `src` (this repo, or a bare clone of it) at `dest`, with the same refs, HEAD and history a plain
 * git clone gives, checked out without bench/ and tournaments/: their recorded runs are most of the tree's files and
 * no test run in a clone reads them. `args` go to git clone, `env` to every git call.
 */
export function leanClone(src, dest, { args = [], env = process.env } = {}) {
  const git = (...a) => execFileSync('git', a, { stdio: 'ignore', env });
  git('clone', '-q', '--no-checkout', ...args, src, dest);
  git('-C', dest, 'sparse-checkout', 'set', '--no-cone', '/*', '!/bench/', '!/tournaments/');
  git('-C', dest, 'reset', '-q', '--hard');
  return dest;
}

/**
 * The environment for a child process a test starts: `from` without NODE_TEST_CONTEXT, which would make a child
 * node --test report to this runner and run nothing, without the `drop` keys, and with `add` set.
 */
export function childEnv({ drop = [], add = {}, from = process.env } = {}) {
  const env = { ...from };
  for (const key of ['NODE_TEST_CONTEXT', ...drop]) delete env[key];
  return { ...env, ...add };
}

export const fresh = () => mkdtempSync(join(tmpdir(), 'regression-'));
// Loaded with the root, so the item's pinned workflow bytes are stored where bin/host.js and the hooks read them.
export const open = (root, { item = 'it-1', session = 'owner', release = '0.2.0' } = {}) => restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session, release });
export const start = (session = 'owner', input = { issue: ISSUE }) => ({ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: session } });
export const rowsOf = (root, item = 'it-1') => readFile(itemFile(root, item)).rows;
export { offer, pending, inputsOfWake };

/**
 * Handlers for the host: every effect goes to run.start. brief/build/verify finish with the next queued output (or stay
 * open when the queue is empty); ask puts up a card (a ref) and stays open; merge counts. `log` keeps every start.
 */
export function handlersFor({ brief = [], build = [], verify = [], merge = null, find = undefined } = {}) {
  const queues = { brief: [...brief], build: [...build], verify: [...verify] };
  const log = [];
  let cards = 0;
  const handlers = {
    run: {
      start: async (effect) => {
        log.push(effect);
        if (effect.actor === 'ask') return { ref: `card-${++cards}`, choices: effect.input.choices };
        if (effect.actor === 'merge') return merge ? merge(effect) : { output: { sha: 'd'.repeat(40) } };
        const q = queues[effect.actor];
        return q?.length ? { ref: effect.id, output: q.shift() } : { ref: effect.id };
      },
      ...(find && { find })
    }
  };
  return { handlers, log, count: (actor) => log.filter((e) => e.actor === actor).length };
}

/** A check_run.completed wake in the shape of packages/engine/test/fixtures/wakes/check-run-failed.txt. */
export const checkWake = ({ head, conclusion = 'failure', check = 'test' }) => `<wake reason="external-event" current-time="2026-10-30T17:02:44Z">
  <event source="github" kind="check_run.completed" from="system" trust="relay" untrusted-keys="check,title,summary,details_url">
    <!-- The following CI check failed on the PR. -->
    ${JSON.stringify({ check, check_run_id: 1, conclusion, details_url: 'https://github.com/o/r/actions/runs/9/job/1', head_sha: head, pr: 'o/r#1' })}
  </event>
</wake>`;

/** An item taken to awaitingMerge on head A (brief, build and a PASS verify finish at once; the card stays open). */
export async function toAwaitingMerge(opts = {}) {
  const root = fresh();
  const host = open(root);
  const h = handlersFor({ brief: [BRIEFS], build: [PR(A)], verify: [VERDICT("PASS", A)], ...opts });
  await offer(host, [start()], h.handlers);
  if (host.snapshot.value !== 'awaitingMerge') throw new Error(`expected awaitingMerge, got ${host.snapshot.value}`);
  return { root, host, ...h };
}
export const askRun = (host) => pending(host).runs.find((r) => r.actor === 'ask');


/** Agent actors that finish at once with the next queued output. */
export const agentActors = ({ brief = [BRIEFS], build = [PR(A)], verify = [VERDICT('PASS', A)] } = {}) => {
  const q = { brief: [...brief], build: [...build], verify: [...verify] };
  return Object.fromEntries(Object.keys(q).map((name) => [name, { start: async (e) => (q[name].length ? { ref: e.id, output: q[name].shift() } : { ref: e.id }) }]));
};

/**
 * The `--test-name-pattern` argument that runs exactly the tests named, each matched whole. A check that a broken rule
 * turns a test file red runs only the tests that rule turns red, and asserts with `ranTests` that they all ran, since a
 * pattern that matches nothing runs nothing and passes.
 */
export const onlyTests = (names) => `--test-name-pattern=${names.map((n) => `^${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).join('|')}`;
/** The names of the tests a TAP output reports, passed or failed, sorted. */
export const ranTests = (out) => [...out.matchAll(/^\s*(?:not )?ok \d+ - (.*)$/gm)].map((m) => m[1].replace(/ # (SKIP|TODO).*$/, '')).sort();
