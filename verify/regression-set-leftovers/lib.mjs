// Shared by the verifier's tests for regression-set-leftovers: the repo, the two commits compared, a git reader that
// fetches the pinned commits into a temp bare repo when the checkout lacks them, and npm test's file lists.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, matchesGlob } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base (main when the build branched) and the build head the verdict names. */
export const BASE = '23cbd22cf08b5f8ed3de3a248ebc9c94adc9631f';
export const VERIFIED = 'fa9c1957cd87f55fc4efd30fe24ac07ee2391cf9';
export const ROOTS = ['test', 'scripts', 'packages', 'plugins'];

const run = (cwd, args, opts = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const has = (dir, sha) => { try { run(dir, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; } };

let objects;
/**
 * A git dir holding BASE and VERIFIED: the checkout when it has both, else a temp bare repo they are fetched into at
 * depth 1 (never the checkout, whose .git/shallow parallel fetches would race on). Null when neither is reachable.
 */
export function gitDir() {
  if (objects !== undefined) return objects;
  if (has(REPO, BASE) && has(REPO, VERIFIED)) return (objects = REPO);
  const dir = mkdtempSync(join(tmpdir(), `rsl-objects-${process.pid}-`));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  const auth = (() => { try { return run(REPO, ['config', '--get-regexp', '^http\\..*extraheader$']).split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  try {
    run(REPO, ['init', '-q', '--bare', dir]);
    run(dir, [...auth, 'fetch', '-q', '--depth=1', run(REPO, ['remote', 'get-url', 'origin']).trim(), BASE, VERIFIED], { timeout: 300_000 });
  } catch { /* checked below */ }
  return (objects = has(dir, BASE) && has(dir, VERIFIED) ? dir : null);
}

export const show = (sha, path) => run(gitDir(), ['show', `${sha}:${path}`]);
export const lsTree = (sha) => run(gitDir(), ['ls-tree', '-r', '--name-only', sha]).split('\n').filter(Boolean);

/** npm test's script split into its passes, each as the quoted globs and bare file paths it hands node --test. */
export function passes(script) {
  return script.split(' && ').map((cmd) => {
    const rest = cmd.replace(/--[\w-]+=(?:"[^"]*"|\S+)/g, ' ');
    return [...rest.matchAll(/"([^"]*)"|(\S+)/g)].map((m) => m[1] ?? m[2]).filter((w) => w.includes('/') && !w.startsWith('-'));
  });
}

/** Expand a pass's patterns the way node --test does: globs over the tree, node_modules left out. */
export function expand(patterns, paths) {
  const out = new Set();
  for (const p of patterns) {
    if (!/[*{?[]/.test(p)) { if (paths.includes(p)) out.add(p); continue; }
    for (const f of paths) if (matches(p, f)) out.add(f);
  }
  return [...out].filter((f) => !f.split('/').includes('node_modules')).sort();
}

/** One glob against one repo-relative path. */
const matches = (p, f) => matchesGlob(f, p);

/** The files the checkout tracks, read from its index, so a depth-1 checkout has them all. */
export const trackedFiles = (root = REPO) => run(root, ['ls-files']).split('\n').filter(Boolean);
