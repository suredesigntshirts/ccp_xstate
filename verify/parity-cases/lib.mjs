// Helpers for the verifier's own parity tests (plan item parity-cases). Written from plan/cases/work-item.md and the
// engine's src alone; nothing here imports the builder's packages/engine/test/parity files.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, inputsOfWake, loadWorkflow, itemFile, sessionFile } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export const spec = loadWorkflow('quick-fix');
export const A = 'a'.repeat(40);
export const B = 'b'.repeat(40);
export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x works'] };
export const BRIEFS = { builder: 'b.md', verifier: 'v.md' };
// Ported to the stage contract (engine-stage-contract): a PR is a ref { url, at }, handed to the item as the host
// stamps it at accept (key, and green when CI was green on at); a verdict restates the PR and the issue and gives one
// line per expect line. A push is CI green on the PR at its new head.
export const PR = (sha) => ({ pr: { url: 'https://github.com/o/r/pull/1', at: sha, key: 'o/r#1', green: true } });
export const VERDICT = (result, sha, issue = ISSUE) => ({ result, pr: { url: 'https://github.com/o/r/pull/1', at: sha }, issue, lines: issue.expect.map((line) => ({ line, result, evidence: 'e' })) });
export const PUSH = (sha) => ({ type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' });

export const fresh = () => mkdtempSync(join(tmpdir(), 'verifier-parity-'));
// Loaded with the root, so the item's pinned workflow bytes are stored where bin/host.js and the hooks read them.
export const open = (root, { item = 'it-1', session = 'owner', release = '0.2.0' } = {}) => restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session, release });
export const start = (session = 'owner', input = { issue: ISSUE }) => ({ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: session } });
export const rowsOf = (root, item = 'it-1') => readFile(itemFile(root, item)).rows;
export const sessionRowsOf = (root, session) => readFile(sessionFile(root, session)).rows;
export { offer, pending, inputsOfWake, itemFile, sessionFile };

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
