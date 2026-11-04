// Verifier helpers for fix-finish-closes-waits, written from the case text, the decision and the engine's src. Nothing
// here reads the builder's tests. Real handlers() from packages/engine/src/effects over a thread client that records
// every card, close and post.
import { handlers } from '../../packages/engine/src/effects/index.js';
import { A, BRIEFS, PR, VERDICT, fresh, open, offer, pending, start, rowsOf } from '../parity-cases/lib.mjs';

export { A, BRIEFS, PR, VERDICT, fresh, open, offer, pending, start, rowsOf };
export const B = 'b'.repeat(40);

/** A thread that records cards, closes and posts. `hold(effect)` true keeps a card from being made (ready false). */
export function recordingThread({ hold = null } = {}) {
  const cards = [];
  const closes = [];
  const posts = [];
  let n = 0;
  const made = new Map();
  const hearth = {
    card: async ({ key, question, choices }) => {
      const ref = `cmsg_${++n}`;
      made.set(key, ref);
      cards.push({ key, ref, question, choices });
      return { ref };
    },
    post: async ({ key, text }) => {
      posts.push({ key, text });
      return { ref: `cmsg_${++n}` };
    },
    close: async ({ key }) => {
      const ref = made.get(key) ?? null;
      closes.push({ key, ref });
      return ref ? { ref } : null;
    },
    ...(hold && { ready: (effect) => effect.type === 'stop' || !hold(effect) })
  };
  return { cards, closes, posts, hearth, clock: { wakeAt: async ({ key }) => ({ ref: `wake ${key}` }) } };
}

export const agents = ({ brief = [BRIEFS], build = [PR(A)], verify = [VERDICT('PASS', A)] } = {}) => {
  const q = { brief: [...brief], build: [...build], verify: [...verify] };
  return Object.fromEntries(Object.keys(q).map((name) => [name, { start: async (e) => (q[name].length ? { ref: e.id, output: q[name].shift() } : { ref: e.id }) }]));
};

/** A quick-fix item driven by the real handlers. Merges are counted and never reached GitHub. */
export async function item({ verify, hold } = {}) {
  const root = fresh();
  const host = open(root);
  const thread = recordingThread({ hold });
  const merges = [];
  const effects = handlers({
    hearth: thread.hearth,
    clock: thread.clock,
    actors: { ...agents(verify ? { verify } : {}), merge: { start: async (e) => { merges.push(e); return { output: { sha: 'd'.repeat(40) } }; } } }
  });
  await offer(host, [start()], effects);
  return { root, host, thread, effects, merges };
}

export const PUSH = (sha) => ({ event: { type: 'github.check_suite.completed', head_sha: sha, pr: 'o/r#1' }, source: { system: 'github', ref: `push-${sha.slice(0, 4)}` } });
export const RED = (sha) => ({ event: { type: 'github.check_run.completed', check: 'test', conclusion: 'failure', head_sha: sha, pr: 'o/r#1', details_url: 'https://x/1' }, source: { system: 'github', ref: 'red-1' } });
export const CLOSED = (outcome) => ({ event: { type: 'github.pull_request.closed', outcome, pr: 'o/r#1' }, source: { system: 'github', ref: `closed-${outcome}` } });

export const tapWake = (cardRef, index = 0) => `<wake reason="decision-chosen" current-time="2026-11-04T21:00:00Z">
  <project id="chan_x" type="project"><thread ts="cmsg_t"><message trigger="true" from="human" trust="principal" author-id="user_x">Chose</message></thread></project>
  <system-note>decision_id=${cardRef}</system-note>
  <system-note>option=A</system-note>
  <system-note>option_index=${index}</system-note>
  <system-note>actor_account_id=user_x</system-note>
</wake>`;

export const stopsPending = (host) => pending(host).effects.filter((e) => e.type === 'stop');
export const asksOpen = (host) => pending(host).runs.filter((r) => r.actor === 'ask');
