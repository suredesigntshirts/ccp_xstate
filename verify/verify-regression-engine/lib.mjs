// Shared by the verifier's tests for verify-regression-engine: the repo, the two commits compared, the 26 suites,
// a git reader that fetches a pinned commit when the checkout is shallow, and a reader for the item's tables.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = process.env.VRE_REPO ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base (main when the build branched and last merged it) and the build head the verdict names. */
export const BASE = '3862da54d33ee537a1f2f0225bdfad80ebc4116d';
export const VERIFIED = 'ad3d01843e81ae27c3e4f23835d14b6b7b03ebe8';
export const ITEM = 'plan/items/verify-regression-engine.md';

export const SUITES = Object.freeze([
  'engine-actor-returns', 'engine-actors', 'engine-cards-standin', 'engine-effects', 'engine-host',
  'engine-stage-contract', 'engine-toy-run', 'fix-blocked-card-grant', 'fix-blocked-retry', 'fix-finish-closes-waits',
  'fix-grant-null-repo', 'fix-other-host-runs-effects', 'fix-rebuild-worktree', 'fix-reminder-wake',
  'fix-verify-issue-echo', 'fix-waiting-wake', 'parity-cases', 'prompt-catalogue', 'retire-pinned-legacy',
  'run-lifecycle-store', 'run-names-one-module', 'stage-bench', 'stage-contract-declares-rules', 'stage-prompt-files',
  'wf-intake', 'wf-quick-fix'
]);
/** Decision 4's eight areas. */
export const AREAS = Object.freeze(['engine', 'run', 'marks', 'journal', 'plugin', 'inspector', 'plan', 'gates']);

/**
 * A git dir holding every sha in `shas`: `root` when it has them, else a temp bare repo they are fetched into at
 * depth 1, removed when the process exits; null when neither can give them. The checkout itself is never fetched
 * into: suites run in parallel, and fetches into one shallow repo collide on its .git/shallow.lock.
 */
function pinnedRepo(root, shas) {
  const run = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 300_000 }).trim();
  const holds = (dir) => shas.every((s) => { try { run(dir, 'cat-file', '-e', `${s}^{commit}`); return true; } catch { return false; } });
  if (holds(root)) return root;
  const dir = mkdtempSync(join(tmpdir(), 'pinned-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
  const auth = (() => { try { return run(root, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  try {
    run(root, 'init', '-q', '--bare', dir);
    run(dir, ...auth, 'fetch', '-q', '--depth=1', run(root, 'remote', 'get-url', 'origin'), ...shas);
  } catch { return null; }
  return holds(dir) ? dir : null;
}

let pinned;
/** git on the repo holding BASE and VERIFIED once haveCommits() found them: the checkout, or the temp repo. */
export const git = (args, opts = {}) => execFileSync('git', ['-C', pinned || REPO, ...args], { encoding: 'utf8', maxBuffer: 1e8, ...opts });

/**
 * Whether BASE and VERIFIED can be read. A depth-1 checkout (ci.yml) lacks them, so both are fetched by sha at depth
 * 1 into a temp repo, which brings their trees. False only when neither git nor the network can give them.
 */
export function haveCommits() {
  if (pinned === undefined) pinned = pinnedRepo(REPO, [BASE, VERIFIED]);
  return pinned !== null;
}

export const show = (sha, path) => git(['show', `${sha}:${path}`]);
export const lsTree = (sha, path) => git(['ls-tree', '-r', '--name-only', sha, '--', path]).split('\n').filter(Boolean);

/** Rows of the markdown table that follows `heading` in the item file, as arrays of cells with backticks removed. */
export function tableAfter(text, heading) {
  const lines = text.split('\n');
  let i = lines.findIndex((l) => l.trim() === heading);
  if (i < 0) throw new Error(`no ${heading}`);
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  const rows = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) {
    const cells = lines[i].slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, ''));
    rows.push(cells);
  }
  return rows.slice(2); // header and its rule
}

/** The Regression table: { suite, file, verdict, to, reason } per row. */
export function regressionTable(root = REPO) {
  const text = readFileSync(join(root, ITEM), 'utf8');
  return tableAfter(text, '## Regression table').map(([suite, file, verdict, to, reason]) => ({ suite, file, verdict, to, reason }));
}

/** Every file under dir, relative to root. */
export function walk(dir, root = REPO) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p)];
  });
}
