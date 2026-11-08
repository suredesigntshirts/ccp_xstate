// Verifier's helpers for plan item done-with-the-build, written from its Expect lines and Verifier brief. DWTB_REPO
// names the checkout under test (default: this repo). Nothing here needs git history: each run happens in a temp repo
// made from a copy of the checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.DWTB_REPO ?? join(HERE, '..', '..'));
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

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'dwtb',
  GIT_AUTHOR_EMAIL: 'dwtb@x', GIT_COMMITTER_NAME: 'dwtb', GIT_COMMITTER_EMAIL: 'dwtb@x' };

/**
 * A temp git repo on main holding a copy of the checkout's `copy` paths in its first commit. commit(files, msg) writes
 * files (null deletes) and commits; gate(which, env) runs pr-gate.mjs from the current tip with BASE_SHA set to `base`.
 */
export function tempRepo(t, { copy = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dwtb-'));
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
    gate(which, { body = '', labels = [], from = base } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: from, HEAD_SHA: '', PR_BRANCH: '', PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}

// The JSON head of an item file and the text after it; and the file back from the two.
export function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
export const joinItem = (head, rest) => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n${rest}`;
