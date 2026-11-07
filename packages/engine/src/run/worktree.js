// A run's git worktree: where it starts (a fresh branch at the clone's HEAD, or a rebuild's PR branch at its head),
// freeing that branch from a finished run's worktree, and the clone's GitHub name for the run's context.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { prRef } from '../effects/merge.js';
import { safe } from '../names.js';

/** owner/repo of the clone's origin when it is on GitHub (https or ssh), else null: the run line names it. */
export function githubOf(repo) {
  let url = '';
  try {
    url = execFileSync('git', ['-C', resolve(repo), 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
  return url.match(/^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/)?.[1] ?? null;
}

// git in a folder, its output trimmed, or null when it fails.
export const git = (dir, args) => {
  try {
    return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};
const hasCommit = (repo, sha) => git(repo, ['cat-file', '-e', `${sha}^{commit}`]) != null;

/** True when `path` is `dir` or inside it. */
export const inside = (dir, path) => {
  const rel = relative(dir, resolve(dir, path));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

/**
 * Where a rebuild's worktree starts: the previous PR's branch (stamped by accept from GitHub's head.ref) at previous.at,
 * the head the host last saw. A missing commit is fetched from origin (the PR's head and its branch) first. Throws,
 * so the run fails and its item steps back, when the branch is unknown or the commit cannot be found.
 */
export function rebuildStart({ repo, worktrees, previous }) {
  const clone = resolve(repo);
  const { branch, at, url } = previous;
  if (typeof branch !== 'string' || !branch || git(clone, ['check-ref-format', '--branch', branch]) == null) {
    throw new Error(`rebuild-branch: previous PR ${url} has no branch the host saw on GitHub (a fork PR, or not read at accept)`);
  }
  const pr = prRef(url);
  const tracking = `refs/remotes/origin/${branch}`;
  if (!hasCommit(clone, at) || git(clone, ['rev-parse', '--verify', '-q', tracking]) == null) {
    git(clone, ['fetch', '-q', 'origin', `+refs/heads/${branch}:${tracking}`]);
    if (!hasCommit(clone, at)) git(clone, ['fetch', '-q', 'origin', `pull/${pr.pullNumber}/head`]);
  }
  if (!hasCommit(clone, at)) throw new Error(`rebuild-head: previous PR ${url} head ${at} is in neither the clone nor origin`);
  const upstream = git(clone, ['rev-parse', '--verify', '-q', tracking]) != null ? `origin/${branch}` : null;
  return { branch, at, upstream };
}

/**
 * git refuses a branch checked out in another worktree. A finished run's worktree (one in the host's worktrees folder)
 * that holds the branch is detached, its files and commits kept; a branch held anywhere else is not touched: throws.
 */
export function freeBranch({ repo, worktrees, branch }) {
  const list = git(resolve(repo), ['worktree', 'list', '--porcelain']) ?? '';
  for (const block of list.split(/\n\n+/)) {
    const path = block.match(/^worktree (.+)$/m)?.[1];
    if (!path || !block.split('\n').includes(`branch refs/heads/${branch}`)) continue;
    if (!inside(resolve(worktrees), path) || resolve(path) === resolve(worktrees)) {
      throw new Error(`rebuild-branch: branch ${branch} is checked out at ${path}, outside the host's worktrees; it is left alone`);
    }
    if (git(path, ['checkout', '-q', '--detach']) == null) throw new Error(`rebuild-branch: could not detach ${path} from ${branch}`);
  }
}

/**
 * The run's worktree, added once: a rebuild (`previous` is a PR ref) works on that PR's branch at its head; any other
 * run gets a fresh branch named by its run, at the clone's HEAD. Returns { worktree, branch }.
 */
export function addWorktree({ repo, worktrees, item, name, previous = null }) {
  const start = previous ? rebuildStart({ repo, worktrees, previous }) : { branch: `run/${safe(item)}/${safe(name)}`, at: 'HEAD' };
  const { branch } = start;
  const worktree = join(resolve(worktrees), `${safe(item)}--${safe(name)}`);
  if (!existsSync(worktree)) {
    mkdirSync(dirname(worktree), { recursive: true });
    if (previous) freeBranch({ repo, worktrees, branch });
    execFileSync('git', ['-C', resolve(repo), 'worktree', 'add', '-q', '-B', branch, worktree, start.at], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (start.upstream) git(worktree, ['branch', '-q', '--set-upstream-to', start.upstream]);
  }
  return { worktree, branch };
}

/** The commit a worktree's HEAD is at, or 'unreadable'. */
export function headOf(worktree) {
  try {
    return execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unreadable';
  }
}
