// Verifier's helpers for plan item verify-evidence-policy, written from the item's Expect lines and its decision
// file; the builder's tests are not read or used. VEP_REPO names the checkout under test (default: this repo).
// Nothing here needs git history: each gate run happens in a temp repo made from a copy of the checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.VEP_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
export const KB64 = 64 * 1024;

const cleanEnv = () => { const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, ...env } = process.env; return env; };

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vep', GIT_AUTHOR_EMAIL: 'vep@x',
  GIT_COMMITTER_NAME: 'vep', GIT_COMMITTER_EMAIL: 'vep@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's plan/, scripts/ and package.json plus
 * baseFiles (a path mapped to its content; null deletes). branch(name) starts a PR-shaped branch from the base;
 * commit(files) commits on it; evidence() runs the evidence gate from the branch tip with BASE_SHA set to the base.
 */
export function gateRepo(t, baseFiles = {}, { copy = ['plan', 'scripts', 'package.json'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vep-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of copy) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const write = (files) => { for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
  } };
  const commit = (files, msg = 'commit') => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    evidence() {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), 'evidence'], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: 'build/vep-case', PR_BODY: '', PR_LABELS: '[]' } });
    },
  };
}
