// Verifier's helpers for plan item verdict-cutoff-at-verified-sha, written from the item's Expect lines and Verifier
// brief; the builder's tests are not read or used. VCV_REPO names the checkout under test (default: this repo).
// Nothing here needs this repo's history: every gate run happens in a temp repo holding a copy of scripts/gates/.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.VCV_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BODY, PR_LABELS, PR_BRANCH, ...env } = process.env;
  return env;
};

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vcv', GIT_AUTHOR_EMAIL: 'vcv@x',
  GIT_COMMITTER_NAME: 'vcv', GIT_COMMITTER_EMAIL: 'vcv@x' };

export const BUILDER = 'Claude-Session: https://claude.ai/code/session_builder';
export const VERIFIER = 'Claude-Session: https://claude.ai/code/session_verifier';

/**
 * An item file: a JSON head (pretty-printed, so each field sits on its own lines) and a Verifier brief.
 * Fields far apart in the file merge without conflict.
 */
export function itemText({ id = 'x', status = 'ready', done_on, check = 'the thing holds', brief = 'Run the test.',
  extra = '' } = {}) {
  const head = { id, title: `Item ${id}`, status, ...(done_on ? { done_on } : {}), outcome: `${id} works`,
    expect: [{ id: 'e1', check, how: 'a test', proof: 'verifier' }] };
  return `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n\n## What this is\n\nAn item for a gate test.\n${extra}\n## Verifier brief\n\n${brief}\n`;
}

/** A temp git repo on main holding a copy of the checkout's scripts/gates/ plus baseFiles (path -> text, null deletes). */
export function tempRepo(t, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vcv-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'scripts/gates'), join(dir, 'scripts/gates'), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  const gate = (which, env) => node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env });
  return { dir, base, git, commit, gate };
}

export const PASSING_TEST = "import test from 'node:test';\ntest('x holds', () => {});\n";
