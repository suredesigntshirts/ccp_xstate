// Shared by the verifier's tests for verify-regression-set: the repo, the two commits compared, the done folders at the
// base, a git reader that fetches the pinned commits into a temp bare repo when the checkout lacks them, and a reader
// for the item's table.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base (main as the build last merged it) and the build head the verdict names. */
export const BASE = 'dcb4c7efd3c24017dacc3c83ea55911cf33f7241';
export const VERIFIED = 'be4c72126ebb668b9a80272f388d26d93d55e232';
export const ID = 'verify-regression-set';
export const ITEM = `plan/items/${ID}.md`;
/** Decision 4's eight areas. */
export const AREAS = Object.freeze(['engine', 'run', 'marks', 'journal', 'plugin', 'inspector', 'plan', 'gates']);

const run = (cwd, args, opts = {}) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1e9, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const has = (dir, sha) => { try { run(dir, ['cat-file', '-e', `${sha}^{commit}`]); return true; } catch { return false; } };

let objects;
/**
 * A git dir holding BASE and VERIFIED: the checkout when it has both, else a temp bare repo they are fetched into at
 * depth 1 (never the checkout: parallel fetches into one shallow repo collide on .git/shallow.lock). Null when
 * neither git nor the network can give them.
 */
export function gitDir() {
  if (objects !== undefined) return objects;
  if (has(REPO, BASE) && has(REPO, VERIFIED)) return (objects = REPO);
  const dir = mkdtempSync(join(tmpdir(), `vrs-objects-${process.pid}-`));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
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
export const lsTree = (sha, path) => git(['ls-tree', '-r', '--name-only', sha, '--', path]).split('\n').filter(Boolean);
export const isTest = (p) => /\.test\.(mjs|js)$/.test(p);

/** The JSON head of an item file's text. */
export function headOf(text) {
  const i = text.indexOf('```json');
  return JSON.parse(text.slice(i + 7, text.indexOf('```', i + 7)));
}

/** The folders under verify/ at the base whose item is done there, this item's aside. */
export function doneAtBase() {
  const folders = [...new Set(lsTree(BASE, 'verify').map((p) => p.split('/')[1]))];
  return folders.filter((f) => {
    if (f === ID) return false;
    try { return headOf(show(BASE, `plan/items/${f}.md`)).status === 'done'; } catch { return false; }
  }).sort();
}

/** The test files the done folders held at the base, as verify/<folder>/<path>. */
export const baseTests = () => doneAtBase().flatMap((f) => lsTree(BASE, `verify/${f}`).filter(isTest));

/** Rows of the first markdown table after `heading`, as arrays of cells with backticks removed. */
export function tableAfter(text, heading) {
  const lines = text.split('\n');
  let i = lines.findIndex((l) => l.trim() === heading);
  if (i < 0) throw new Error(`no ${heading}`);
  while (i < lines.length && !lines[i].startsWith('|')) i++;
  const rows = [];
  for (; i < lines.length && lines[i].startsWith('|'); i++) rows.push(lines[i].slice(1, -1).split('|').map((c) => c.trim().replace(/`/g, '')));
  return rows.slice(2); // header and its rule
}

/** The Regression table at the head: { file, verdict, to, reason } per row; file is verify/<folder>/<name>. */
export function regressionTable(root = REPO) {
  return tableAfter(readFileSync(join(root, ITEM), 'utf8'), '## Regression table').map(([file, verdict, to, reason]) => ({ file, verdict, to, reason }));
}

/** Every file under dir, relative to root. */
export function walk(dir, root = REPO) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p, root) : [relative(root, p)];
  });
}
