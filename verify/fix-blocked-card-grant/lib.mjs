// Verifier helpers for fix-blocked-card-grant, written from the item, plan/decisions/2026-11-05-blocked-card-grant.md
// and the engine's src; nothing here reads the builder's tests. The engine is real (restore, offer, pump, the real
// handlers, the agent run handler, spawn/bind/accept, resultsOf), and the thread is the command line's own relay, so a
// card waits until `bin/host.js card` records it and is answered only by `bin/host.js answer`, as a stand-in does.
// Only the outside is stubbed: origin is a local bare repo, GitHub a local REST server for any owner/repo, the agents
// functions that act in their worktrees. Imports are relative, so a copy of this folder in a checkout of main drives
// main's engine.
import { createServer } from 'node:http';
import { execFileSync, spawn as spawnProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, pending, itemFile } from '../../packages/engine/src/host.js';
import { actors, accept, bind, spawn, loadRun } from '../../packages/engine/src/actors.js';
import { handlers, github, pump, relay } from '../../packages/engine/src/effects/index.js';
import { loadWorkflow, workflowOf } from '../../packages/engine/src/index.js';
import { readFile } from '../../packages/journal/src/index.js';

export const SESSION = 'owner';
export const RELEASE = '0.2.0';
export const ISSUE_URL = 'https://github.com/o/r/issues/7';
export const EXPECT = ['math.js exports multiply'];
export const BRIEFS = { builder: 'build it', verifier: 'verify it independently' };
export const REASON = 'push refused: token lacks workflow scope for .github/workflows/ci.yml; grant it, then retry';
export const FAR = '2999-01-01T00:00:00Z';
const ID = ['-c', 'user.email=v@v', '-c', 'user.name=verifier', '-c', 'commit.gpgsign=false'];
const cli = new URL('../../packages/engine/bin/host.js', import.meta.url).pathname;

export const tmp = (name) => mkdtempSync(join(tmpdir(), `vfbcg-${name}-`));
export const git = (dir, ...args) => execFileSync('git', ['-C', dir, ...ID, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
const head = (dir) => git(dir, 'rev-parse', 'HEAD');

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

/** GitHub REST for any owner/repo: PRs keyed "owner/repo#n", check suites by sha, merges recorded. */
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
      const cs = path.match(/^\/repos\/[^/]+\/[^/]+\/commits\/([0-9a-f]+)\/check-suites$/);
      if (cs) return reply(200, { total_count: (suites[cs[1]] ?? []).length, check_suites: suites[cs[1]] ?? [] });
      const mg = path.match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)\/merge$/);
      if (mg && req.method === 'PUT') {
        const key = `${mg[1]}#${mg[2]}`;
        const p = prs[key];
        const sha = JSON.parse(body || '{}').sha;
        if (!p || p.head !== sha) return reply(409, { message: 'Head branch was modified' });
        p.merged = true; p.mergeSha = 'e'.repeat(40);
        merges.push({ pr: key, sha });
        return reply(200, { merged: true, sha: p.mergeSha });
      }
      const m = path.match(/^\/repos\/([^/]+\/[^/]+)\/pulls\/(\d+)(\/files)?$/);
      const p = m && prs[`${m[1]}#${m[2]}`];
      if (!p) return reply(404, { message: 'Not Found' });
      if (m[3]) return reply(200, p.files.map((filename) => ({ filename })));
      return reply(200, { number: Number(m[2]), merged: !!p.merged, merge_commit_sha: p.mergeSha ?? null, state: 'open', head: { sha: p.head, ref: p.ref, repo: { full_name: m[1] } }, base: { ref: 'main' } });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  const api = `http://127.0.0.1:${server.address().port}`;
  return {
    prs, suites, merges, api,
    client: github({ api, env: {} }),
    green: (sha) => { suites[sha] = [{ status: 'completed', conclusion: 'success' }]; },
    close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); })
  };
}

let n = 0;
const commit = (dir, msg) => { git(dir, 'commit', '-q', '--allow-empty', '-m', `${msg} ${++n}`); return head(dir); };

/** A quick-fix world over the real engine, the thread being the command line's relay. */
export async function world({ issueUrl = ISSUE_URL } = {}) {
  const harness = tmp('harness');
  const root = join(harness, 'journal');
  mkdirSync(root, { recursive: true });
  const { origin, clone } = originAndClone();
  const gh = await stubGitHub();
  let cardNo = 0;
  const w = {
    harness, root, origin, repo: clone, worktrees: join(harness, 'wt'), gh, issueUrl,
    handlersFor: (host) => handlers({ github: gh.client, hearth: relay({ root }), actors: actors({ host, repo: w.repo, worktrees: w.worktrees }), host }),
    host: (item) => restore({ root, item, spec: workflowOf(root, item), session: SESSION, release: RELEASE }),
    start: async (item) => {
      const host = restore({ root, item, spec: loadWorkflow('quick-fix', { root }), session: SESSION, release: RELEASE });
      await offer(host, [{ event: { type: 'xstate.init', input: { issue: { url: issueUrl, expect: EXPECT } } }, source: { system: 'claude-code', ref: `start ${item}` } }], w.handlersFor(host));
      await w.drive(item);
    },
    drive: (top) => pump({ root, top, session: SESSION, release: RELEASE, handlersFor: w.handlersFor, inputsFor: () => [] }),
    rows: (item) => readFile(itemFile(root, item)).rows,
    snap: (item) => w.host(item).snapshot,
    state: (item) => w.host(item).snapshot.value,
    openRun: (item, actor) => pending(w.host(item)).runs.find((r) => r.actor === actor) ?? null,
    agent: async (item, actor, act) => {
      const run = w.openRun(item, actor);
      if (!run) throw new Error(`no open ${actor} run on ${item} (state ${JSON.stringify(w.state(item))})`);
      const id = `ag-${run.id}`.replace(/[^\w-]/g, '_');
      spawn({ root, prompt: `ccp-run ${run.id}`, toolUseId: `tu_${id}` });
      bind({ root, agentId: id, toolUseId: `tu_${id}` });
      const prepared = loadRun(root, run.id);
      const result = await act({ run, input: run.input, prepared, worktree: prepared.worktree });
      const got = await accept({ root, caller: id, run: run.id, result, toolUseId: `tu_${id}_ret`, github: gh.client });
      if (!got.accepted) throw new Error(`${actor} result refused: ${JSON.stringify(got)}`);
      await w.drive(item);
      return run;
    },
    /** bin/host.js <command> ... for `item`, with the stub GitHub and the world's repo. */
    cli: (item, command, args = []) => new Promise((ok) => {
      const c = spawnProcess(process.execPath, [cli, command, '--item', item, '--workflow', 'quick-fix', '--root', root, '--release', RELEASE, '--repo', w.repo, '--worktrees', w.worktrees, ...args],
        { env: { ...process.env, CCP_GITHUB_API: gh.api }, cwd: w.repo });
      let stdout = '', stderr = '';
      c.stdout.on('data', (d) => (stdout += d));
      c.stderr.on('data', (d) => (stderr += d));
      c.on('close', (status) => { let json = null; try { json = JSON.parse(stdout); } catch {} ok({ status, stdout, stderr, json }); });
      c.stdin.end('');
    }),
    /** Put up the open ask's card with `host.js card`; returns { effect, ref }. */
    putCard: async (item) => {
      const ask = w.openRun(item, 'ask');
      if (!ask) throw new Error(`no open ask on ${item}`);
      const ref = `cmsg_vcard${++cardNo}`;
      const r = await w.cli(item, 'card', ['--effect', ask.id, '--ref', ref]);
      if (r.status !== 0) throw new Error(`card refused: ${r.stderr}`);
      return { effect: ask.id, ref, input: ask.input };
    },
    grants: (list) => { const f = join(harness, `grants-${++cardNo}.json`); writeFileSync(f, JSON.stringify({ grants: list })); return f; },
    answer: (item, { effect, choice, by = 'standin-session', why, grants }) =>
      w.cli(item, 'answer', ['--effect', effect, '--choice', choice, '--by', by, ...(why != null ? ['--why', why] : []), '--grants', grants]),
    close: () => gh.close()
  };
  return w;
}

export const blocked = (reason = REASON) => async () => ({ blocked: { reason } });
/** A builder that opens PR `repo`#`pr` (default the issue's repo) and greens it. */
export const builds = (w, { repo = 'o/r', pr = 1 } = {}) => async ({ worktree, prepared }) => {
  const sha = commit(worktree, 'build');
  git(worktree, 'push', '-q', 'origin', `HEAD:refs/heads/${prepared.branch}`);
  w.gh.prs[`${repo}#${pr}`] = { head: sha, ref: prepared.branch, files: ['math.js'] };
  w.gh.green(sha);
  return { pr: { url: `https://github.com/${repo}/pull/${pr}`, at: sha } };
};
export const verifies = (result) => async ({ input, worktree }) => {
  git(worktree, 'checkout', '-q', '--detach', input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: input.issue, lines: input.issue.expect.map((line) => ({ line, result, evidence: `${result} by the verifier stub` })) };
};
export const grant = (over = {}) => ({ id: 'vg', workflow: 'quick-fix', ask: 'ask', choices: ['retry', 'replan', 'drop'], repos: ['o/r'], until: FAR, ...over });
