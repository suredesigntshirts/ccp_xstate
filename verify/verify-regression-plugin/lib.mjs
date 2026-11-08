// Shared by the verifier's tests for verify-regression-plugin: the repo, the two commits compared, the 19 suites,
// a git reader that fetches a pinned commit when the checkout is shallow, and a reader for the item's table.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = process.env.VRP_REPO ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base (main as the build last merged it) and the build head the verdict names. */
export const BASE = '0ac82af53330032d800fd32fdbb257089ee26b89';
export const VERIFIED = '142b5ac875fd84d3d8dbdaf60eab2415a5ab3d21';
export const ITEM = 'plan/items/verify-regression-plugin.md';

export const SUITES = Object.freeze([
  'engine-item-views', 'fix-agent-finish-ms', 'fix-inspector-guard-label', 'fix-refusal-hints',
  'fix-return-tool-answer', 'fix-waiting-lines-owner', 'fix-waiting-run-stall', 'harness-glossary',
  'inspector-catalogue-entries', 'inspector-reads-records', 'inspector-stage-record', 'journal-schema',
  'obs-journal-vs-world', 'obs-live-capture', 'obs-page', 'obs-person-attention', 'obs-refusal-log',
  'obs-time-and-rework', 'workflow-inspector'
]);
/** Decision 4's eight areas. */
export const AREAS = Object.freeze(['engine', 'run', 'marks', 'journal', 'plugin', 'inspector', 'plan', 'gates']);

export const git = (args, opts = {}) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 1e8, ...opts });
const has = (sha) => { try { git(['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; } };

/**
 * Whether BASE and VERIFIED can be read here. A depth-1 checkout (ci.yml) lacks them, so each is fetched by sha
 * at depth 1, which brings its tree. False only when neither git nor the network can give them.
 */
export function haveCommits() {
  for (const sha of [BASE, VERIFIED]) {
    if (has(sha)) continue;
    try { git(['fetch', '-q', '--depth=1', 'origin', sha], { stdio: 'ignore', timeout: 120_000 }); } catch { /* checked below */ }
    if (!has(sha)) return false;
  }
  return true;
}

export const show = (sha, path) => git(['show', `${sha}:${path}`]);
export const lsTree = (sha, path) => git(['ls-tree', '-r', '--name-only', sha, '--', path]).split('\n').filter(Boolean);

/** The *.test.mjs files the 19 suites held at the base, as verify/<suite>/<file>. */
export const baseTests = () => SUITES.flatMap((s) => lsTree(BASE, `verify/${s}`).filter((p) => p.endsWith('.test.mjs')));

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

/** The Regression table: { file, verdict, to, reason } per row; file is verify/<suite>/<name>. */
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
