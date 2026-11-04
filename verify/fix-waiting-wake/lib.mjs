// Helpers for the fix-waiting-wake verifier's tests. Written from plan/cases/work-item.md (C-waiting-does-not-stall),
// plan/decisions/2026-11-04-waiting-wake.md and the engine's src; the builder's tests for this item are not read.
// The engine is real: restore/offer/pending, inputsOfWake, and handlers() from packages/engine/src/effects over a
// thread client and a clock that record every card, close, wake and drop. Agents are stubs.
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, inputsOfWake, loadWorkflow, itemFile } from '../../packages/engine/src/index.js';
import { handlers } from '../../packages/engine/src/effects/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export { offer, pending, inputsOfWake };
export const HOUR = 3600000;
export const A = 'a'.repeat(40);
export const B = 'b'.repeat(40);
export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['x works'] };
export const PR_URL = 'https://github.com/o/r/pull/1';
export const PR = (at, extra = {}) => ({ pr: { url: PR_URL, at, key: 'o/r#1', green: true, ...extra } });
export const VERDICT = (at, pr = {}) => ({ result: 'PASS', pr: { url: PR_URL, at, ...pr }, issue: ISSUE, lines: [{ line: 'x works', result: 'PASS', evidence: 'e' }] });
export const PUSH = (sha) => ({ type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' });

export const fresh = () => mkdtempSync(join(tmpdir(), 'verify-fww-'));
export const open = (root, item, workflow = 'quick-fix', session = 'owner') =>
  restore({ root, item, spec: loadWorkflow(workflow, { root }), session, release: '0.2.0' });
export const start = (session = 'owner', input = { issue: ISSUE }) =>
  ({ event: { type: 'xstate.init', input }, source: { system: 'claude-code', ref: session } });
export const rowsOf = (root, item) => readFile(itemFile(root, item)).rows;

/** The thread and the clock, recording. A card is closed by its run key. */
export function world() {
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
export function agents(queues) {
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

export const handlersOf = (w, actors, github = null) => handlers({ github, hearth: w.hearth, clock: w.clock, actors });

/** A tap on a card, in the shape of packages/engine/test/fixtures/wakes/tap-wake.txt, at a time. */
const fixture = (name) => readFileSync(new URL(`../../packages/engine/test/fixtures/wakes/${name}.txt`, import.meta.url), 'utf8');
export const tapWake = (card, index = 0) => fixture('tap-wake')
  .replace(/decision_id=[^<]*/, `decision_id=${card}`).replace(/option_index=[^<]*/, `option_index=${index}`);
/** A real wake (check_suite.completed for another PR, which moves nothing here) at a given current-time. */
export const wakeAt = (at) => fixture('check-suite-completed').replace(/current-time="[^"]*"/, `current-time="${at}"`);

/** The transition row that entered `state` most recently. */
export const entered = (root, item, state) => rowsOf(root, item)
  .filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && JSON.parse(r.state) === state).at(-1);
export const shift = (iso, ms) => new Date(Date.parse(iso) + ms).toISOString();
