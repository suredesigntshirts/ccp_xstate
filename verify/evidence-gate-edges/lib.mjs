// Verifier's helpers for plan item evidence-gate-edges, written from the item's Expect lines and its decision file;
// the builder's tests are not read or used. EGE_REPO names the checkout under test (default: this repo). Nothing here
// needs git history: each gate run happens in a temp repo made from a copy of the checkout, and every listing fixture
// is made at run time by running node:test, so no file under verify/ holds result lines.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.EGE_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
export const KB = 1024;

const cleanEnv = () => { const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, ...env } = process.env; return env; };

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'ege', GIT_AUTHOR_EMAIL: 'ege@x',
  GIT_COMMITTER_NAME: 'ege', GIT_COMMITTER_EMAIL: 'ege@x' };

export function tempDir(t, prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's scripts/ and package.json plus baseFiles.
 * branch(name) starts a PR-shaped branch from the base; commit(files, links) writes files (null deletes) and symlinks
 * (path -> target) and commits; evidence() runs the evidence gate from the branch tip with BASE_SHA set to the base.
 */
export function gateRepo(t, baseFiles = {}) {
  const dir = tempDir(t, 'ege-gate-');
  for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, links = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    for (const [p, target] of Object.entries(links)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      symlinkSync(target, join(dir, p));
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, {}, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    evidence() {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), 'evidence'], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: 'build/ege-case', PR_BODY: '', PR_LABELS: '[]' } });
    },
  };
}

/** Real node:test output of a file with n passing tests: piped with no reporter (TAP), or with the named reporter. */
export function listing(t, n, reporter) {
  const dir = tempDir(t, 'ege-listing-');
  const body = ["import test from 'node:test';"];
  for (let i = 1; i <= n; i++) body.push(`test('case ${i}', () => {});`);
  writeFileSync(join(dir, 'ten.test.mjs'), body.join('\n') + '\n');
  const r = node(['--test', ...(reporter ? [`--test-reporter=${reporter}`] : []), 'ten.test.mjs'], { cwd: dir });
  if (r.status !== 0) throw new Error(r.out);
  return r.stdout;
}
