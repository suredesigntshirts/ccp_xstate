// The verifier's helpers: a temp journal root beside a scratch git repo, bin/host.js run against it, stub agent
// results written where the return tool writes them, and a GitHub REST stub for the merge effect.
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { runDir, resultHash } from '../../packages/engine/src/names.js';
import { spawn as spawnRun, bind } from '../../packages/engine/src/actors.js';

const cli = new URL('../../packages/engine/bin/host.js', import.meta.url).pathname;

/** A temp harness folder: { root (its journal), grants (its grants.json), repo (a git repo of one commit, the cwd) }. */
export function world() {
  const dir = mkdtempSync(join(tmpdir(), 'verify-second-workflow-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  const root = join(dir, 'harness', 'journal');
  mkdirSync(root, { recursive: true });
  const repo = join(dir, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, '-c', 'user.email=v@v', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'empty']);
  return { dir, root, repo, grants: join(dir, 'harness', 'grants.json') };
}

/**
 * Runs bin/host.js, asynchronously so a GitHub stub in this process can answer it; resolves { status, out (parsed
 * stdout or null), stderr }.
 */
export function host(w, args, { stdin = '', env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args, '--root', w.root, '--release', '0.9.0'], { cwd: w.repo, env: { ...process.env, ...env } });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (c) => (stdout += c));
    child.stderr.on('data', (c) => (stderr += c));
    child.on('close', (status) => {
      let out = null;
      try { out = JSON.parse(stdout); } catch { /* not JSON */ }
      resolve({ status, out, stderr });
    });
    child.stdin.end(stdin);
  });
}

/** A UserPromptSubmit hook input for `bin/host.js wake`. */
export const prompt = (session, text) => JSON.stringify({ hook_event_name: 'UserPromptSubmit', session_id: session, prompt: text });

/**
 * A stub agent for `run`: its Agent call starts the run and the agent binds (the real spawn and bind of the harness
 * hooks), then its result is written where the return hook stores an accepted one (run/store.js result.json), with
 * any ref fields the host stamps already set.
 */
export function returned(root, run, result) {
  const toolUseId = `toolu_${run.replace(/\W/g, '_')}`;
  const agentId = `agent_${run.replace(/\W/g, '_')}`;
  if (!spawnRun({ root, prompt: `ccp-run ${run}`, toolUseId, session: 'owner' })?.allow) throw new Error(`${run} did not start`);
  if (!bind({ root, agentId, toolUseId, session: 'owner' })) throw new Error(`${run} did not bind`);
  const path = join(runDir(root, run), 'result.json');
  writeFileSync(path, `${JSON.stringify({ result, hash: resultHash(result), sent: resultHash(result), caller: agentId, toolUseId, at: new Date().toISOString() }, null, 2)}\n`, { flag: 'wx' });
}

/** A GitHub REST stub: merges any PR, answering with a merge sha; records every call. Resolves { url, calls, close }. */
export function githubStub() {
  const calls = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      calls.push({ method: req.method, path: req.url, body: body ? JSON.parse(body) : null });
      const m = req.url.match(/^\/repos\/([^/]+)\/([^/]+)\/pulls\/(\d+)(\/merge)?/);
      res.setHeader('content-type', 'application/json');
      if (m && m[4] && req.method === 'PUT') return res.end(JSON.stringify({ merged: true, sha: m[3].padStart(40, 'c') }));
      if (m) return res.end(JSON.stringify({ number: Number(m[3]), merged: false, head: { sha: 'unknown' } }));
      res.statusCode = 404;
      res.end(JSON.stringify({ message: 'not stubbed' }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ url: `http://127.0.0.1:${server.address().port}`, calls, close: () => server.close() })));
}

/** A check suite's wake, as the platform delivers a GitHub PR event. */
export const checkSuite = (pr, sha, at = '2026-11-11T12:00:00Z') => `<wake reason="external-event" current-time="${at}">
  <event source="github" kind="check_suite.completed" from="system" trust="relay">
    {"head_sha":"${sha}","pr":"${pr}"}
  </event>
</wake>`;

export const grant = (w, entries) => writeFileSync(w.grants, JSON.stringify({ grants: entries }, null, 2));

/**
 * A stub of GitHub REST for prFacts: `prs` maps a PR number to { body, labels, head, commits: [message], files: [path] }.
 * Returns get(path), answering the reads prFacts makes.
 */
export const restStub = (prs) => async (path) => {
  const m = path.match(/^\/repos\/[^/]+\/[^/]+\/(pulls|commits)\/([^/?]+)(?:\/(\w+))?/);
  if (!m) throw new Error(`not stubbed: ${path}`);
  if (m[1] === 'commits') return { check_runs: [{ id: Number.parseInt(m[2].slice(-8), 16), name: 'test', status: 'completed', conclusion: 'success', started_at: '2026-11-11T09:01:00Z', completed_at: '2026-11-11T09:02:00Z' }] };
  const pr = prs[m[2]];
  if (!m[3]) return { body: pr.body ?? null, labels: (pr.labels ?? []).map((name) => ({ name })), head: { ref: pr.head }, merged_at: null };
  const page = Number(path.match(/[?&]page=(\d+)/)?.[1] ?? 1);
  if (page > 1) return [];
  if (m[3] === 'commits') return pr.commits.map((message, i) => ({ sha: `${m[2]}${i}`.padStart(40, 'f'), parents: [{}], commit: { message, committer: { date: '2026-11-11T09:00:00Z' } } }));
  return pr.files.map((f) => ({ filename: typeof f === 'string' ? f : f.path, changes: typeof f === 'string' ? 10 : f.changes }));
};
