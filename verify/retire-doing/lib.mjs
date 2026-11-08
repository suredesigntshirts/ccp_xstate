// Verifier's helpers for plan item retire-doing, written from the item's Expect lines and Verifier brief; the
// builder's tests are not read or used. RD_REPO names the checkout under test (default: this repo). Nothing here needs
// git history: plan checks run on temp copies of plan/, and gate runs happen in temp repos made from the checkout.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.RD_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;
export const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
export const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** The modules the checkout's ready items name; a plan copy lacks them, so they are made as empty files. */
const readyModules = () => readdirSync(join(REPO, 'plan/items')).filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE)?.[1] ?? '{}'))
  .filter((it) => it.module && it.status === 'ready').map((it) => it.module);
export function makeModules(dir, extra = []) {
  for (const p of [...readyModules(), ...extra]) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), ''); }
}

/** A complete ready item file with a new id: this item's own file, its status and fields replaced. */
export function itemText(id, fields = {}) {
  const text = read('plan/items/retire-doing.md');
  const head = { ...headOf(text), id, status: 'ready', ...fields };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) delete head[k];
  return withHead(text, head);
}

/** A temp copy of the checkout's plan/ at <dir>/plan; write(id, text) adds an item, check() runs plan/check.mjs. */
export function tempPlan(t, { modules = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rd-plan-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  makeModules(dir, modules);
  return {
    dir,
    write(id, text) { writeFileSync(join(dir, 'plan/items', `${id}.md`), text); },
    check() { return node([join(dir, 'plan/check.mjs')]); },
  };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rd', GIT_AUTHOR_EMAIL: 'rd@x',
  GIT_COMMITTER_NAME: 'rd', GIT_COMMITTER_EMAIL: 'rd@x' };

/**
 * A temp git repo whose base commit on main holds a copy of the checkout's plan/, scripts/ and package.json plus
 * baseFiles. branch(name) starts a PR branch from the base; commit(files, msg) writes and commits; gate(which, env)
 * runs pr-gate.mjs from the branch tip with BASE_SHA at the base.
 */
export function gateRepo(t, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'rd-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  makeModules(dir);
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', `${msg}\n\nClaude-Session: https://claude.ai/code/session_rd`);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  const base = commit(baseFiles, 'base');
  return {
    dir, base, git, commit,
    branch(name) { git('checkout', '-q', '-B', name, base); },
    gate(which, { branch = '', body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), which], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}
