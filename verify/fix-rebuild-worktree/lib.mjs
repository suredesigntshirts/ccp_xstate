// Verifier helpers for fix-rebuild-worktree, written from the item, the decision (plan/decisions/2026-11-05-rebuild-
// worktree.md), cases C-red-ci-back-to-building and C-second-fail-replans, and the engine's src. Nothing here reads the
// builder's tests. The engine is real (restore, offer, pump, the real handlers and agent run handler, spawn/bind/accept);
// only the outside is stubbed: origin is a local bare repo, GitHub is a local REST server whose PRs carry head.ref and
// head.repo, and the agents are functions that act in their worktrees.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../packages/engine/src/host.js';
import { inputsOfWake } from '../../packages/engine/src/wake.js';
import { actors, accept, bind, spawn, loadRun, runDir } from '../../packages/engine/src/actors.js';
import { handlers, github, pump } from '../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export { pending, offer, runDir };
export const SESSION = 'owner';
export const RELEASE = '0.2.0';
export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['math.js exports multiply'] };
export const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
export const prUrl = (n) => `https://github.com/o/r/pull/${n}`;
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier'];

export const tmp = (name) => mkdtempSync(join(tmpdir(), `vfrw-${name}-`));
export const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const tryGit = (dir, ...args) => { try { return git(dir, ...args); } catch { return null; } };
export const head = (dir) => git(dir, 'rev-parse', 'HEAD');
export const branchOf = (dir) => git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');

/** A bare origin with one commit on main, and a clone of it (the host's --repo). */
export function originAndClone() {
  const origin = tmp('origin');
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin]);
  const seed = tmp('seed');
  execFileSync('git', ['clone', '-q', origin, seed], { stdio: 'ignore' });
  git(seed, 'checkout', '-q', '-b', 'main');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'base');
  git(seed, 'push', '-q', 'origin', 'main');
  return { origin, clone: cloneOf(origin) };
}
export function cloneOf(origin) {
  const clone = tmp('clone');
  execFileSync('git', ['clone', '-q', origin, clone], { stdio: 'ignore' });
  return clone;
}

/** GitHub for o/r: PRs { head, ref, repo (head.repo; undefined leaves the key out), files }, suites by sha. */
export async function stubGitHub() {
  const prs = {};
  const suites = {};
  const server = createServer((req, res) => {
    req.resume();
    req.on('end', () => {
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      const path = req.url.split('?')[0];
      const cs = path.match(/^\/repos\/o\/r\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const m = path.match(/^\/repos\/o\/r\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[m[1]];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[2]) return reply(200, p.files.map((filename) => ({ filename })));
      const h = { sha: p.head, ref: p.ref };
      if (p.repo !== undefined) h.repo = p.repo === null ? null : { full_name: p.repo };
      return reply(200, { number: Number(m[1]), merged: false, merge_commit_sha: null, head: h, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return {
    prs, suites,
    client: github({ api: `http://127.0.0.1:${server.address().port}`, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

const ev = (kind, json) => `<wake reason="external-event" current-time="2026-11-05T02:00:00Z">\n  <event source="github" kind="${kind}" from="system" trust="relay">\n    ${JSON.stringify(json)}\n  </event>\n</wake>`;
export const redWake = (sha, n = 1) => ev('check_run.completed', { check: 'test', check_run_id: 1, conclusion: 'failure', details_url: `https://ci/test/${sha}`, head_sha: sha, pr: `o/r#${n}` });
export const suiteWake = (sha, n = 1) => ev('check_suite.completed', { head_sha: sha, pr: `o/r#${n}` });

/** A host world over the real engine. `w.repo`/`w.worktrees` may be swapped (a host on a fresh clone). */
export async function world() {
  const root = tmp('root');
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  const w = {
    root, origin, repo: clone, worktrees: join(root, 'wt'), gh,
    handlersFor: (host) => handlers({ github: gh.client, actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top, text = '') => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor,
      inputsFor: (host) => (text ? inputsOfWake(host, text, { now: '2999-01-01T00:00:00Z' }) : []) }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    /** An agent through the real hooks: spawn, bind, act in its worktree, accept. */
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      return accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
    },
    close: () => gh.close()
  };
  return w;
}

let n = 0;
export const commit = (dir, msg = 'work') => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/**
 * A first builder: commits in its worktree, pushes to origin as `as` (default: its run branch), opens PR `pr` on the
 * stub GitHub with head.ref = that branch and head.repo = `repo`.
 */
export const firstBuild = (w, { pr = 1, as = null, repo = 'o/r', green = true } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'first build');
  const ref = as ?? prepared.branch;
  git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${ref}`);
  w.gh.prs[pr] = { head: sha, ref, repo, files: ['math.js'] };
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};

/** A rebuilder that records what it found, commits, and pushes with a plain `git push`. */
export const rebuild = (w, seen, { pr = 1, green = true } = {}) => async ({ worktree, prepared, input }) => {
  seen.push({ worktree, prepared, input, head: head(worktree), branch: branchOf(worktree), upstream: tryGit(worktree, 'rev-parse', '--abbrev-ref', '@{u}') });
  const sha = commit(worktree, 'rebuild');
  git(worktree, 'push', '-q');
  w.gh.prs[pr].head = sha;
  if (green) w.gh.green(sha);
  return { pr: { url: prUrl(pr), at: sha } };
};

export const verdict = (result) => async ({ input }) => ({
  result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue,
  lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` }))
});

/** The verify run checks out the target detached, as the verify rule says. */
export const verifies = (w, result) => async (a) => { git(a.worktree, 'checkout', '-q', '--detach', a.input.target.at); return verdict(result)(a); };

export const readRun = (root, runId) => loadRun(root, runId);
export const exists = existsSync;
