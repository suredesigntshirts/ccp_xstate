// Verifier's helpers for plan item pinned-fetch-temp-repo, written from the item's Expect lines and Verifier brief.
// origin() builds a full temp origin that serves any sha. When this checkout lacks the pinned commits or their history
// (ci.yml checks out at depth 1), it fetches them from GitHub into that temp repo, borrowing actions/checkout's
// extraheader, so this checkout's .git is never written. shallowClone() makes the depth-1 clone the suites run in.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
/** The build head the verdict names: the build's own commit with main merged in. */
export const HEAD = '6ff276e37502a5b3a0e88b2835b31e9b1ff72702';
/** The build's own last commit, before main was merged in. */
export const BUILD = '3f18736fc33c9739f66cee19d20b32af2e4c0bee';
/** The main merged in at HEAD (its second parent), after the item's contract change #257. */
export const MAIN = '342148726b0310f5f297cf33b91be30432aaf989';
/** The start-timing test files parallel-green leaves out of the twelve-way run. */
export const TIMING = ['verify/test-fixture-edges/p95-over-bare.test.mjs', 'verify/verify-regression-engine/moved-pass.test.mjs'];
/** The readying replan's head, which the build sits on. */
export const READY = 'dd5fcc570a908b8fc833dbe9704f96be5957f6a7';
/** main when the build was rebased: the PR's base, whose four suites still fetch into the checkout. */
export const BASE = '2178cc6c0e9b86456c7dc35fd352b16952356bf1';
export const SUITES = ['verify/fix-trace-writes-clone-cwd', 'verify/test-fixture-edges',
  'verify/map-once-traps-written', 'verify/verify-regression-engine'];
/** The four files the item names, one per suite. */
export const FILES = ['verify/fix-trace-writes-clone-cwd/lib.mjs', 'verify/test-fixture-edges/scope.test.mjs',
  'verify/map-once-traps-written/suite-and-scope.test.mjs', 'verify/verify-regression-engine/lib.mjs'];

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'pftr',
  GIT_AUTHOR_EMAIL: 'pftr@x', GIT_COMMITTER_NAME: 'pftr', GIT_COMMITTER_EMAIL: 'pftr@x' };
export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1e8,
  env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 }).trim();
const hasIn = (dir, sha) => { try { git(dir, 'cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };
const complete = (dir) => git(dir, 'rev-parse', '--is-shallow-repository') === 'false';
const PINNED = [HEAD, BUILD, MAIN, READY, BASE];
const tmp = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), prefix));
  process.on('exit', () => rmSync(d, { recursive: true, force: true }));
  return d;
};

/** A full bare origin holding HEAD and BASE with history, serving any sha; null when git and the network cannot. */
let made;
export function origin() {
  if (made !== undefined) return made;
  const dir = tmp('pftr-origin-');
  git(dir, 'init', '-q', '--bare');
  try {
    if (complete(REPO) && PINNED.every((s) => hasIn(REPO, s))) {
      git(dir, 'fetch', '-q', REPO, ...PINNED.map((s, i) => `${s}:refs/heads/p${i}`));
    } else {
      // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
      const auth = (() => { try { return git(REPO, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
        .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
      git(dir, ...auth, 'fetch', '-q', git(REPO, 'remote', 'get-url', 'origin'),
        ...PINNED.map((s, i) => `${s}:refs/heads/p${i}`));
    }
  } catch { return (made = null); }
  if (!PINNED.every((s) => hasIn(dir, s)) || !complete(dir)) return (made = null);
  git(dir, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
  git(dir, 'symbolic-ref', 'HEAD', 'refs/heads/p0');
  return (made = dir);
}

/** A depth-1 clone of HEAD from origin(), with no origin/main, node_modules borrowed from REPO. */
export function shallowClone(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pftr-clone-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  git(tmpdir(), 'clone', '-q', '--depth=1', '--branch', 'p0', `file://${origin()}`, dir);
  if (existsSync(join(REPO, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

/** The clone's .git/shallow, as a sorted list of shas. */
export const shallowList = (dir) => readFileSync(join(dir, '.git/shallow'), 'utf8').split('\n').filter(Boolean).sort();

/** Overwrite the four files in dir with their text at sha. */
export function putFilesAt(dir, sha) {
  for (const f of FILES) writeFileSync(join(dir, f), git(origin(), 'show', `${sha}:${f}`) + '\n');
}

/**
 * node --test on one suite in dir, PR variables removed; resolves { suite, status, out }. opts.serial runs its files
 * one at a time; opts.leave names test files to leave out.
 */
export function runSuite(dir, suite, opts = {}) {
  const leave = new Set(opts.leave ?? []);
  const files = readdirSync(join(dir, suite)).filter((n) => n.endsWith('.test.mjs')).map((n) => `${suite}/${n}`)
    .filter((f) => !leave.has(f)).sort();
  const { NODE_TEST_CONTEXT, PR_BODY, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_LABELS, ...env } = process.env;
  return new Promise((done) => {
    const p = spawn(process.execPath, ['--test', ...(opts.serial ? ['--test-concurrency=1'] : []), ...files], { cwd: dir, env });
    let out = '';
    p.stdout.on('data', (b) => { out += b; });
    p.stderr.on('data', (b) => { out += b; });
    const timer = setTimeout(() => p.kill('SIGKILL'), 600_000);
    p.on('close', (status) => { clearTimeout(timer); done({ suite, status, out }); });
  });
}

/** A short summary of a node --test run: its pass and fail counts, and the first failing test's name. */
export const summary = (r) => {
  const n = (k) => (r.out.match(new RegExp(`^# ${k} (\\d+)`, 'm')) ?? [, '?'])[1];
  const fail = (r.out.match(/^\s*not ok \d+ - (.*)$/m) ?? [, ''])[1];
  return `${r.suite}: exit ${r.status}, pass ${n('pass')}, fail ${n('fail')}, skipped ${n('skipped')}${fail ? `, first fail: ${fail.slice(0, 120)}` : ''}`;
};
