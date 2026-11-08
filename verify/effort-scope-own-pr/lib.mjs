// Verifier's helpers for plan item effort-scope-own-pr, written from the item's Expect lines and Verifier brief. The
// commits compared are pinned. When this checkout lacks them or their history (ci.yml checks out at depth 1),
// commits() fetches them in full into a temp repo, so the checkout itself is left as it was; each run of the suite
// under test happens in a temp repo that borrows those objects.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(process.env.ESOP_REPO ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
/** The build head the verdict names, after its readying replan (#233) merged and main was merged in. */
export const HEAD = '0baec6327126ece07b8f5dc7a99069cb6e3c89ba';
/** The PR's base on GitHub, which is also what origin/main pointed to when this verifier ran. */
export const MAIN = '6a43f408e2b6049ec03b9bd488fd99866f709baa';
/** plan-reader-effort's build PR #212: its last commit (second parent of its merge) and its base (the first parent). */
export const PR212 = '6339fa58a43d5e538223d529d8a94b5631ce92f9';
export const PR212_BASE = 'e12655529525141a85168ce9ce2c969576c5fd65';
export const SUITE = 'verify/plan-reader-effort/plan-and-suite-pass.test.mjs';
export const TRAPS = 'docs/traps.md';

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'esop',
  GIT_AUTHOR_EMAIL: 'esop@x', GIT_COMMITTER_NAME: 'esop', GIT_COMMITTER_EMAIL: 'esop@x' };
export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1e8,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasIn = (dir, sha) => { try { git(dir, 'cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };
const complete = (dir) => git(dir, 'rev-parse', '--is-shallow-repository') === 'false';
export const PINNED = [HEAD, MAIN, PR212, PR212_BASE];

/** The git dir whose objects hold every pinned commit with its history, or null when neither git nor the network can. */
let source;
export function commits() {
  if (source !== undefined) return source;
  if (complete(REPO) && PINNED.every((s) => hasIn(REPO, s))) return (source = git(REPO, 'rev-parse', '--git-common-dir'));
  const dir = mkdtempSync(join(tmpdir(), 'esop-objects-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
  const auth = (() => { try { return git(REPO, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  try {
    git(REPO, 'init', '-q', '--bare', dir);
    execFileSync('git', [...auth, 'fetch', '-q', git(REPO, 'remote', 'get-url', 'origin'), ...PINNED], { cwd: dir,
      stdio: 'ignore', timeout: 300_000 });
  } catch { return (source = null); }
  return (source = PINNED.every((s) => hasIn(dir, s)) && complete(dir) ? dir : null);
}
/** A full clone stand-in: a temp repo borrowing REPO's objects, origin/main set to `main`, checked out at `at`. */
export function clone(t, at, main = MAIN) {
  const dir = mkdtempSync(join(tmpdir(), 'esop-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q');
  const objects = resolve(REPO, commits(), 'objects');
  writeFileSync(join(dir, '.git/objects/info/alternates'), `${objects}\n`);
  g('update-ref', 'refs/remotes/origin/main', main);
  g('checkout', '-q', '--detach', at);
  if (existsSync(join(REPO, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  const put = (p, text) => writeFileSync(join(dir, p), text);
  /** One more commit adding a file outside plan-reader-effort's outputs. */
  const stray = (p) => { put(p, 'outside the outputs\n'); g('add', p); g('commit', '-q', '-m', 'stray'); };
  return { dir, git: g, put, stray };
}

/** A file as it is at a commit. */
export const fileAt = (sha, p) => git(resolve(REPO, commits()), 'show', `${sha}:${p}`);
export const suiteAt = (sha) => fileAt(sha, SUITE);

/** node --test on the suite in dir, with the PR variables removed unless env sets them. */
export function runSuite(dir, env = {}) {
  const { NODE_TEST_CONTEXT, PR_BODY, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_LABELS, ...rest } = process.env;
  const r = spawnSync(process.execPath, ['--test', SUITE], { cwd: dir, encoding: 'utf8', env: { ...rest, ...env },
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

/** The diagnostic line that names the mode the suite ran in. */
export const modeLine = (out) => (out.match(/^.*#\s*(?:PR mode|tree mode|depth-1 mode)[^\n]*/m) ?? ['(no mode line)'])[0]
  .replace(/^\s*#\s*/, '').slice(0, 300);
