// Verifier's helpers for plan item rules-said-once, written from the item's Expect lines and Verifier brief; the
// builder's tests are not read or used. RSO_REPO names the checkout under test (default: this repo). Nothing here
// needs git history: each gate run happens in a temp repo made from a copy of the checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.RSO_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rso', GIT_AUTHOR_EMAIL: 'rso@x',
  GIT_COMMITTER_NAME: 'rso', GIT_COMMITTER_EMAIL: 'rso@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's `copy` paths. branch(name) starts a
 * PR-shaped branch from the base; commit(files, msg) writes files (null deletes) and commits; gate(which, env) runs
 * pr-gate.mjs from the branch tip with BASE_SHA set to the base and PR_BRANCH, PR_BODY, PR_LABELS from env.
 */
export function gateRepo(t, { copy = ['plan', 'scripts', 'package.json'] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rso-gate-'));
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
    file: (p) => readFileSync(join(dir, p), 'utf8'),
    branch(name) { git('checkout', '-q', '-B', name, base); },
    gate(which, { branch = '', body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// The JSON head of an item file and the text after it.
export function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
