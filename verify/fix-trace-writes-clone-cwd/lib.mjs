// Verifier's helpers for plan item fix-trace-writes-clone-cwd, written from the item's Expect lines and Verifier
// brief. The traces are synthetic, in the shape the tracer writes with -f -qq -y, so no tracer runs here. The base and head
// commits are pinned; when this checkout lacks them (ci.yml checks out at depth 1), they are fetched at depth 1 into a
// temp bare repo and read there, and a test that still cannot read them skips that half, saying why.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base on GitHub (main e9ed7db, as merged into the branch) and the head this verdict names. */
export const BASE = 'e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4';
export const HEAD = '82c86117f65646132646540b8006bed66aa2b2a4';
export const MODULE = 'scripts/debug/trace-writes.mjs';

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
const objects = () => (pinned === undefined ? (pinned = pinnedRepo(ROOT, [BASE, HEAD])) : pinned);

/** git on the repo holding the base and head: the checkout, or the temp repo they were fetched into. */
export const git = (...a) => execFileSync('git', ['-C', objects() ?? ROOT, ...a], { encoding: 'utf8', maxBuffer: 1e8,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** True when the base and head (`sha` is one of them) can be read, fetching them first if they are not here. */
export const ensure = (sha) => [BASE, HEAD].includes(sha) && objects() !== null;

/** writesUnder from the checkout (the head). */
export const headWritesUnder = async () => (await import(pathToFileURL(join(ROOT, MODULE)).href)).writesUnder;

/** writesUnder as it was at the base, read with git show into a temp file, or null when the base cannot be read. */
export async function baseWritesUnder(t) {
  if (!ensure(BASE)) return null;
  const dir = mkdtempSync(join(tmpdir(), 'ftwcc-base-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = join(dir, 'trace-writes-base.mjs');
  writeFileSync(file, git('show', `${BASE}:${MODULE}`) + '\n');
  return (await import(pathToFileURL(file).href)).writesUnder;
}

const CLONE_ARGS = 'child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f2a6c1b9a10';
/** A parent's clone split in two halves, as the tracer under -f writes them when another pid's line comes between. */
export const cloneStart = (pid) => `${pid}   clone(${CLONE_ARGS} <unfinished ...>`;
export const cloneResumed = (pid, child) => `${pid}   <... clone resumed>) = ${child}`;
export const cloneWhole = (pid, child) => `${pid}   clone(${CLONE_ARGS}) = ${child}`;
export const chdir = (pid, p) => `${pid}   chdir("${p}") = 0`;
export const mkdir = (pid, p) => `${pid}   mkdir("${p}", 0777) = 0`;
export const exit = (pid) => `${pid}   +++ exited with 0 +++`;
export const trace = (...lines) => lines.join('\n') + '\n';

/** The paths writesUnder reports for one call kind. */
export const paths = (hits, call = 'mkdir') => hits.filter((h) => h.call === call).map((h) => h.path);
