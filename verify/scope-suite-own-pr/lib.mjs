// Verifier's helpers for plan item scope-suite-own-pr, written from the item's Expect lines and Verifier brief. The
// commits compared are pinned. When this checkout lacks them or their history (ci.yml checks out at depth 1),
// commits() fetches them in full into a temp repo, so the checkout itself is left as it was; each run of the suite
// under test happens in a temp repo that borrows those objects.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(process.env.SSOP_REPO ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
/** The build head the verdict names, and the readying replan's head the build is stacked on. */
export const HEAD = '37f6dfce1a6cc749ab3d973acbb26f826a8c890c';
export const READY = '9f0cbc5b1bbea14d6725dee595eaca3c3e9f4c11';
/** The PR's base on GitHub: the merge of rules-said-once's PR #202 into main. */
export const MAIN_BASE = '81fd7a6d7ba27e7074bdec8b7136624d39aca85f';
/** What origin/main pointed to when this verifier ran. */
export const MAIN = '97947de2a0555f447a221bad3855eeaf6d2f033c';
/** #202's last commit (second parent of its merge) and its base (the first parent). */
export const PR202 = '1af034ec917ba56eb2130ac16ed304b8315c828f';
export const PR202_BASE = '66e47a6a5417484a3da9947148fcb25de73e6738';
export const SUITE = 'verify/rules-said-once/suite-and-scope.test.mjs';

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'ssop',
  GIT_AUTHOR_EMAIL: 'ssop@x', GIT_COMMITTER_NAME: 'ssop', GIT_COMMITTER_EMAIL: 'ssop@x' };
export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1e8,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const hasIn = (dir, sha) => { try { git(dir, 'cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };
const complete = (dir) => git(dir, 'rev-parse', '--is-shallow-repository') === 'false';
export const PINNED = [HEAD, READY, MAIN_BASE, MAIN, PR202, PR202_BASE];

/** The git dir whose objects hold every pinned commit with its history, or null when neither git nor the network can. */
let source;
export function commits() {
  if (source !== undefined) return source;
  if (complete(REPO) && PINNED.every((s) => hasIn(REPO, s))) return (source = git(REPO, 'rev-parse', '--git-common-dir'));
  const dir = mkdtempSync(join(tmpdir(), 'ssop-objects-'));
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
  const dir = mkdtempSync(join(tmpdir(), 'ssop-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const g = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8',
    env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  g('init', '-q');
  const objects = resolve(REPO, commits(), 'objects');
  writeFileSync(join(dir, '.git/objects/info/alternates'), `${objects}\n`);
  g('update-ref', 'refs/remotes/origin/main', main);
  g('checkout', '-q', '--detach', at);
  if (existsSync(join(REPO, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return { dir, git: g, put: (p, text) => writeFileSync(join(dir, p), text) };
}

/** The suite file as it is at a commit. */
export const suiteAt = (sha) => git(resolve(REPO, commits()), 'show', `${sha}:${SUITE}`);

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
