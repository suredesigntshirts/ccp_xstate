// Verifier's helpers for plan item fix-trace-writes-clone-cwd, written from the item's Expect lines and Verifier
// brief. The traces are synthetic, in the shape the tracer writes with -f -qq -y, so no tracer runs here. The base and head
// commits are pinned; when this checkout lacks one (ci.yml checks out at depth 1), it is fetched at depth 1, and a
// test that still cannot read it skips that half, saying why.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
/** The PR's base on GitHub (main after the readying replan #215 merged) and the head this verdict names. */
export const BASE = '8244eae5c7b411b175f05af25f2144555e7abfb0';
export const HEAD = '6472dc6bd76d43db4c6ace82f857f15403020abc';
export const MODULE = 'scripts/debug/trace-writes.mjs';

export const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 1e8,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const have = (sha) => { try { git('cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };

/** True when the commit is readable here, fetching it at depth 1 first if it is not. */
export function ensure(sha) {
  if (have(sha)) return true;
  try { execFileSync('git', ['-C', ROOT, 'fetch', '-q', '--depth=1', 'origin', sha], { stdio: 'ignore', timeout: 120_000 }); } catch { return false; }
  return have(sha);
}

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
