// Verifier's helpers for plan item verification-contract, written from the item's Expect lines and
// plan/decisions/2026-11-08-verification-swing.md; the builder's tests are not read or used. VC_REPO names the
// checkout under test (default: this repo). Nothing here needs git history, so a depth-1 CI checkout works.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.VC_REPO ?? join(HERE, '..', '..'));

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;

/** The modules the checkout's ready and doing items name. */
const liveModules = () => readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => JSON.parse(readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE)?.[1] ?? '{}'))
  .filter((it) => it.module && ['ready', 'doing'].includes(it.status))
  .map((it) => it.module);
export const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
export const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

// The phrases decision 1 lists, copied from the decision file, not from check.mjs.
export const DECISION_PHRASES = ['as on main', 'as main', 'on main', 'than main', "main's", 'unchanged', 'same as',
  'byte', 'bytes', 'both shas'];

const cleanEnv = () => { const { NODE_TEST_CONTEXT, ...env } = process.env; return env; };

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** A complete ready item file, for adding to a copy of plan/: the head item's own file with a new id. */
export function itemText(id, fields = {}) {
  const text = readFileSync(join(REPO, 'plan/items/verification-contract.md'), 'utf8');
  const head = { ...headOf(text), id, ...fields };
  for (const [k, v] of Object.entries(fields)) if (v === undefined) delete head[k];
  return withHead(text, head);
}

/** A copy of plan/ lacks the rest of the tree: make an empty file at each module a ready or doing item names. */
export function makeLiveModules(dir) {
  for (const path of liveModules()) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), ''); }
}

/** A temp folder holding a copy of the checkout's plan/ at <dir>/plan. */
export function tempPlan(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-plan-'));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  makeLiveModules(dir);
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  return {
    dir,
    write(id, text) { writeFileSync(join(dir, 'plan/items', `${id}.md`), text); },
    check() { return node([join(dir, 'plan/check.mjs')]); },
  };
}

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vc', GIT_AUTHOR_EMAIL: 'vc@x',
  GIT_COMMITTER_NAME: 'vc', GIT_COMMITTER_EMAIL: 'vc@x' };

/**
 * A temp git repo holding the checkout's plan/ and scripts/ (plus baseFiles) as its base commit on main, then a PR
 * branch. Commit
 * with commit(files, session); run a gate with gate(name, { body, labels }) from the branch tip.
 */
export function gateRepo(t, branch, baseFiles = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-gate-'));
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  makeLiveModules(dir);
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '-b', 'main');
  const write = (files) => { for (const [p, c] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, p)), { recursive: true });
    if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
  } };
  const commit = (files, session, msg = 'commit') => {
    write(files);
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', `${msg}\n\nClaude-Session: ${session}`);
    return git('rev-parse', 'HEAD');
  };
  const base = commit(baseFiles, 'https://claude.ai/code/session_vc_base', 'base');
  git('checkout', '-q', '-b', branch);
  return {
    dir, base, git, commit,
    gate(name, { body = '', labels = [] } = {}) {
      return node([join(dir, 'scripts/gates/pr-gate.mjs'), name], { cwd: dir, env: {
        BASE_SHA: base, HEAD_SHA: '', PR_BRANCH: branch, PR_BODY: body, PR_LABELS: JSON.stringify(labels) } });
    },
  };
}
