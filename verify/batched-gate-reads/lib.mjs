// Shared by this folder's tests: the head's pr-gate.mjs, the base's beside it, and temp repos seeded with this
// checkout's plan/, scripts/, packages/, plugins/ and verify/ to run both against.
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HEAD_GATE = join(REPO, 'scripts', 'gates', 'pr-gate.mjs');
export const GATES = ['freeze', 'stubs', 'evidence', 'verdict'];

const gitEnv = (home) => ({ PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', HOME: home });

/**
 * The base pr-gate.mjs (main at 829fa83b, kept as evidence/base-pr-gate.mjs.txt because ci's depth-1 checkout has no
 * base commit) in a temp folder beside a copy of the head's lib.mjs, which this PR does not change.
 */
export function baseGate(t) {
  const dir = mkdtempSync(join(tmpdir(), 'batched-base-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyFileSync(join(REPO, 'verify', 'batched-gate-reads', 'evidence', 'base-pr-gate.mjs.txt'), join(dir, 'pr-gate.mjs'));
  copyFileSync(join(REPO, 'scripts', 'gates', 'lib.mjs'), join(dir, 'lib.mjs'));
  return join(dir, 'pr-gate.mjs');
}

/** A temp repo whose first commit, the PR's base, holds this checkout's plan/, scripts/, packages/, plugins/ and verify/, plus
 * what prep(repo) writes. */
export function seededRepo(t, { dirs = ['plan', 'scripts', 'packages', 'plugins', 'verify'], prep } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'batched-gate-repo-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = gitEnv(dir);
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=v', '-c', 'user.email=v@example.com',
    '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env, maxBuffer: 64 << 20 }).trim();
  git('init', '-q', '-b', 'main');
  // The tracked files only, at this checkout's HEAD, so the seed is the same in a fresh clone and in ci.
  execFileSync('sh', ['-c', `git -C "$1" archive HEAD ${dirs.join(' ')} | tar -x -C "$2"`, 'sh', REPO, dir], { env: { ...env, HOME: process.env.HOME ?? dir } });
  const r = {
    dir, git,
    write(p, data) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), data); },
    remove(p) { rmSync(join(dir, p), { recursive: true, force: true }); },
    link(target, p) { mkdirSync(dirname(join(dir, p)), { recursive: true }); symlinkSync(target, join(dir, p)); },
    links: [],
    commit(msg) {
      git('add', '-A');
      for (const [p, sha] of r.links.splice(0)) git('update-index', '--add', '--cacheinfo', `160000,${sha},${p}`);
      git('commit', '-q', '--allow-empty', '-m', msg); return git('rev-parse', 'HEAD');
    },
    /** Adds, at the next commit, a gitlink (a submodule entry) at p pointing at sha, without a .gitmodules. */
    gitlink(p, sha) { r.links.push([p, sha]); },
  };
  prep?.(r);
  r.base = r.commit('seed\n\nClaude-Session: seed');
  return r;
}

/** Runs one gate script in repo with the PR's env; returns exit code, stdout, stderr and wall ms. */
export function runGate(script, which, repo, env = {}) {
  const start = process.hrtime.bigint();
  const { NODE_TEST_CONTEXT, ...rest } = process.env;
  const r = spawnSync(process.execPath, [script, which], {
    cwd: repo.dir, encoding: 'utf8', maxBuffer: 64 << 20,
    env: { ...rest, ...gitEnv(repo.dir), BASE_SHA: repo.base, HEAD_SHA: repo.git('rev-parse', 'HEAD'),
      PR_BODY: 'Item: x\n', PR_LABELS: '[]', ...env },
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, ms: Number(process.hrtime.bigint() - start) / 1e6 };
}
