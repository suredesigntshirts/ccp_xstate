// Shared by the verifier's tests for fast-test-clones-and-setup: the repo, the two commits compared, a git reader that
// fetches them into a temp bare repo when the checkout lacks them, the test trees and the stub tools.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base (main after the readying replan) and the build head the verdict names. */
export const BASE = '4f221631407e919218e0726147a431dd94a9fd15';
export const VERIFIED = 'be40cff22a443e1d5be0f9dd0ac1cce00837e00b';
/** The four trees whose tests the item's checks cover. */
export const TREES = Object.freeze(['test', 'scripts', 'packages', 'plugins']);
export const SETUP = join(REPO, 'infra', 'cloud-environment', 'setup.sh');

export const run = (cwd, args, opts = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const has = (dir, sha) => { try { run(dir, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; } };

const made = [];
process.on('exit', () => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
/** A temp folder removed when the process exits. */
export function temp(name) {
  const d = mkdtempSync(join(tmpdir(), `vftc-${name}-`));
  made.push(d);
  return d;
}

let objects;
/**
 * A git dir holding BASE and VERIFIED: the checkout when it has both, else a temp bare repo they are fetched into at
 * depth 1 (never the checkout: parallel fetches into one shallow repo collide on .git/shallow.lock).
 */
export function gitDir() {
  if (objects !== undefined) return objects;
  if (has(REPO, BASE) && has(REPO, VERIFIED)) return (objects = REPO);
  const dir = temp('objects');
  // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
  const auth = (() => { try { return run(REPO, ['config', '--get-regexp', '^http\\..*extraheader$']).split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  try {
    run(REPO, ['init', '-q', '--bare', dir]);
    run(dir, [...auth, 'fetch', '-q', '--depth=1', run(REPO, ['remote', 'get-url', 'origin']).trim(), BASE, VERIFIED], { timeout: 300_000 });
  } catch { /* checked below */ }
  return (objects = has(dir, BASE) && has(dir, VERIFIED) ? dir : null);
}
export const git = (args) => run(gitDir(), args);
export const show = (sha, path) => git(['show', `${sha}:${path}`]);

/** Every .js and .mjs file under the four trees at the checkout, repo-relative, node_modules aside. */
export function codeFiles(root = REPO) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(mjs|js)$/.test(e.name)) out.push(relative(root, p));
    }
  };
  for (const t of TREES) walk(join(root, t));
  return out.sort();
}
export const isTest = (p) => /\.test\.(mjs|js)$/.test(p);
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

/** The environment a test of setup.sh runs it in: this one, less the session's own CLAUDE* and CCP* names. */
export function cleanEnv(extra = {}) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|CCP)/.test(k)));
  return { ...env, ...extra };
}

/** Writes an executable `name` into `bin` with `body` after a bash shebang. */
export function stub(bin, name, body) {
  mkdirSync(bin, { recursive: true });
  writeFileSync(join(bin, name), `#!/bin/bash\n${body}`);
  chmodSync(join(bin, name), 0o755);
  return join(bin, name);
}
