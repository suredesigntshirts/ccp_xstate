// Verifier helpers for fix-blocked-retry, written from the item, plan/decisions/2026-11-05-blocked-retry.md and the
// engine's src; nothing here reads the builder's tests. The engine is real: restore, offer, pump, the real handlers,
// the agent run handler, spawn/bind/accept and resultsOf (so a blocked return reaches the chart the way a real one
// does). Only the outside is stubbed: origin is a local bare repo, GitHub a local REST server, the thread a recorder of
// cards, and the agents functions that act in their worktrees. Imports are relative, so a copy of this folder in a
// checkout of main drives main's engine (scenarios.mjs).
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../packages/engine/src/host.js';
import { inputsOfWake } from '../../packages/engine/src/wake.js';
import { actors, accept, bind, spawn, stopped, loadRun } from '../../packages/engine/src/actors.js';
import { handlers, github, pump } from '../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export const SESSION = 'owner';
export const RELEASE = '0.2.0';
export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['math.js exports multiply'] };
export const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
export const REASON = 'push refused: refusing to allow a token without workflow scope to update .github/workflows/ci.yml; grant the workflow scope, then retry';
export const prUrl = (n) => `https://github.com/o/r/pull/${n}`;
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];

export const tmp = (name) => mkdtempSync(join(tmpdir(), `vfbr-${name}-`));
export const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
export const head = (dir) => git(dir, 'rev-parse', 'HEAD');

function originAndClone() {
  const origin = tmp('origin');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const seed = tmp('seed');
  execFileSync('git', ['clone', '-q', origin, seed], { stdio: 'ignore' });
  git(seed, 'checkout', '-q', '-b', 'main');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(seed, 'push', '-q', 'origin', 'main');
  const clone = tmp('clone');
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  return { origin, clone };
}

async function stubGitHub() {
  const prs = {};
  const suites = {};
  const merges = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      const path = req.url.split('?')[0];
      const cs = path.match(/^\/repos\/o\/r\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const mg = path.match(/^\/repos\/o\/r\/pulls\/(\d+)\/merge$/);
      if (mg && req.method === 'PUT') {
        const p = prs[mg[1]];
        const sha = JSON.parse(body || '{}').sha;
        if (!p || p.head !== sha) return reply(409, { message: 'Head branch was modified' });
        p.merged = true; p.mergeSha = 'e'.repeat(40);
        merges.push({ pr: Number(mg[1]), sha });
        return reply(200, { merged: true, sha: p.mergeSha });
      }
      const m = path.match(/^\/repos\/o\/r\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[m[1]];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[2]) return reply(200, p.files.map((filename) => ({ filename })));
      return reply(200, { number: Number(m[1]), merged: !!p.merged, merge_commit_sha: p.mergeSha ?? null, state: 'open', head: { sha: p.head, ref: p.ref, repo: { full_name: 'o/r' } }, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return {
    prs, suites, merges,
    client: github({ api: `http://127.0.0.1:${server.address().port}`, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

/** A thread that records every card it is asked to put up. */
function thread() {
  const cards = [];
  let n = 0;
  return {
    cards,
    hearth: {
      card: async ({ key, question, choices, inputs }) => { const ref = `cmsg_card${++n}`; cards.push({ key, ref, question, choices, inputs }); return { ref }; },
      post: async () => ({ ref: `cmsg_post${++n}` }),
      close: async ({ key }) => { const c = cards.find((x) => x.key === key); return c ? { ref: c.ref } : null; }
    },
    clock: { wakeAt: async ({ key }) => ({ ref: `wake ${key}` }) }
  };
}

const ev = (kind, json) => `<wake reason="external-event" current-time="2026-11-05T16:00:00Z">\n  <event source="github" kind="${kind}" from="system" trust="relay">\n    ${JSON.stringify(json)}\n  </event>\n</wake>`;
export const redWake = (sha, n = 1) => ev('check_run.completed', { check: 'test', check_run_id: 1, conclusion: 'failure', details_url: `https://ci/test/${sha}`, head_sha: sha, pr: `o/r#${n}` });
export const tapWake = (ref, index) => `<wake reason="decision-chosen" current-time="2026-11-05T16:00:00Z">
  <project id="chan_x" type="project"><thread ts="cmsg_t"><message trigger="true" from="human" trust="principal" author-id="user_x">Chose</message></thread></project>
  <system-note>decision_id=${ref}</system-note>
  <system-note>option=x</system-note>
  <system-note>option_index=${index}</system-note>
  <system-note>actor_account_id=user_person</system-note>
</wake>`;

let n = 0;
const commit = (dir, msg) => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/** A quick-fix host world over the real engine. */
export async function world() {
  const root = tmp('root');
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  const th = thread();
  const w = {
    root, origin, repo: clone, worktrees: join(root, 'wt'), gh, cards: th.cards, seen: [],
    handlersFor: (host) => handlers({ github: gh.client, hearth: th.hearth, clock: th.clock, actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top, text = '') => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor,
      inputsFor: (host) => (text ? inputsOfWake(host, text, { now: '2999-01-01T00:00:00Z' }) : []) }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    snap: (item) => w.host(item).snapshot,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** An agent through the real hooks: spawn, bind, act in its worktree, accept; then drive. */
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      w.seen.push({ actor, run: run.id, input: run.input });
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      const got = await accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
      if (!got.accepted) throw new Error(`${actor} result refused: ${JSON.stringify(got)}`);
      await w.drive(item);
      return run;
    },
    /** An agent that binds and then stops without returning (failed.json). */
    stops: async (item, actor) => {
      const run = w.openRun(item, actor);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      stopped({ root, agentId: id, again: true });
      await w.drive(item);
      return run;
    },
    /** Tap choice `choice` on the newest card. */
    tap: async (item, choice) => {
      const card = w.cards.at(-1);
      const index = card.choices.indexOf(choice);
      if (index < 0) throw new Error(`"${choice}" is not on the card (${card.choices})`);
      await w.drive(item, tapWake(card.ref, index));
    },
    close: () => gh.close()
  };
  return w;
}

/** Builders and verifiers. */
export const blocked = (reason = REASON) => async () => ({ blocked: { reason } });
export const builds = (w, { pr = 1, green = true } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'build');
  const prev = w.gh.prs[pr];
  if (prev) { git(worktree, 'push', '-q', '-f', 'origin', `HEAD:refs/heads/${prev.ref}`); prev.head = sha; } else {
    git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${prepared.branch}`);
    w.gh.prs[pr] = { head: sha, ref: prepared.branch, files: ['math.js'] };
  }
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};
export const verifies = (result) => async ({ input, worktree }) => {
  git(worktree, 'checkout', '-q', '--detach', input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue, lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` })) };
};

/** The newest card's choices and the error event the newest error transition applied. */
export const lastCard = (w) => w.cards.at(-1) ?? null;
export function lastError(w, item) {
  const row = w.rows(item).filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied' && String(r.payload.event?.type ?? '').startsWith('xstate.error.actor.')).at(-1);
  return row?.payload.event ?? null;
}
