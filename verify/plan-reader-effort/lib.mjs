// Verifier's helpers for plan item plan-reader-effort, written from the item's Expect lines, its Verifier brief and
// plan/decisions/2026-11-08-plan-reader-effort.md; the builder's tests are not read or used. PRE_REPO names the
// checkout under test (default: this repo). Nothing here reads this repository's git history: every run happens in a
// temp git repo, so the tests pass in ci.yml's depth-1 checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.PRE_REPO ?? join(HERE, '..', '..'));
export const SCRIPT = join(REPO, 'scripts/reader-effort.mjs');
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}`, stdout: r.stdout };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'pre', GIT_AUTHOR_EMAIL: 'pre@x',
  GIT_COMMITTER_NAME: 'pre', GIT_COMMITTER_EMAIL: 'pre@x' };

/**
 * A temp git repo on main. commit(files, msg) writes files (null deletes) and commits; branch(name) starts a branch
 * from the current main; merge(name, n) merges it into main with --no-ff as "Merge pull request #n from x/<name>".
 * effort(arg) runs the checkout's reader-effort.mjs from the repo with --json and parses the object.
 */
export function tempRepo(t, { copy = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-repo-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of copy) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit({}, 'base');
  return {
    dir, base, git, commit,
    branch(name, from = 'main') { git('checkout', '-q', '-B', name, from); },
    merge(name, n) {
      git('checkout', '-q', 'main');
      git('merge', '-q', '--no-ff', '-m', `Merge pull request #${n} from x/${name}`, name);
      return git('rev-parse', 'HEAD');
    },
    effort(arg) {
      const r = node([SCRIPT, arg, '--json'], { cwd: dir });
      if (r.status !== 0) throw new Error(`reader-effort ${arg} exited ${r.status}: ${r.out}`);
      return JSON.parse(r.stdout);
    },
    gate(which, { body = '', labels = [], branch = '' } = {}, baseSha = base) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: baseSha, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// A file of n numbered lines, each ending in a newline.
export const lines = (n, tag = 'l') => Array.from({ length: n }, (_, i) => `${tag}${i + 1}`).join('\n') + '\n';

// The JSON head of an item file and the text after it.
export function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
export const joinItem = (head, rest) => '```json\n' + JSON.stringify(head, null, 2) + '\n```\n' + rest;

export { symlinkSync, cpSync, mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync };
