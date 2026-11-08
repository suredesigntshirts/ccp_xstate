// Expect: fix-trace-writes-clone-cwd/child-before-return, fix-trace-writes-clone-cwd/child-after-return
// writesUnder resolves a traced child's relative writes against its own chdir, or the parent's folder at the clone,
// whether the child's lines come before or after the clone returns its pid. The traces are synthetic, in the shape the
// tracer writes with -f -qq -y, so no tracer runs here.
import assert from 'node:assert/strict';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Helpers for the tests below.
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const MODULE = 'scripts/debug/trace-writes.mjs';

/** writesUnder from the checkout. */
const headWritesUnder = async () => (await import(pathToFileURL(join(REPO, MODULE)).href)).writesUnder;

const CLONE_ARGS = 'child_stack=NULL, flags=CLONE_CHILD_CLEARTID|CLONE_CHILD_SETTID|SIGCHLD, child_tidptr=0x7f2a6c1b9a10';
/** A parent's clone split in two halves, as the tracer under -f writes them when another pid's line comes between. */
const cloneStart = (pid) => `${pid}   clone(${CLONE_ARGS} <unfinished ...>`;
const cloneResumed = (pid, child) => `${pid}   <... clone resumed>) = ${child}`;
const cloneWhole = (pid, child) => `${pid}   clone(${CLONE_ARGS}) = ${child}`;
const chdir = (pid, p) => `${pid}   chdir("${p}") = 0`;
const mkdir = (pid, p) => `${pid}   mkdir("${p}", 0777) = 0`;
const exit = (pid) => `${pid}   +++ exited with 0 +++`;
const trace = (...lines) => lines.join('\n') + '\n';

/** The paths writesUnder reports for one call kind. */
const paths = (hits, call = 'mkdir') => hits.filter((h) => h.call === call).map((h) => h.path);

{
const ROOT = '/vroot';
const START = '/vstart'; // outside ROOT, so a path resolved against it is not reported
const P = 4100, C = 4101;

// The child chdirs into sub and makes "made" before the parent's clone line returns its pid.
const withChdir = trace(chdir(P, `${ROOT}/p`), cloneStart(P), chdir(C, 'sub'), mkdir(C, 'made'), cloneResumed(P, C),
  exit(C), exit(P));
// The same order, the child making a relative mkdir without any chdir of its own.
const noChdir = trace(chdir(P, `${ROOT}/p`), cloneStart(P), mkdir(C, 'm2'), cloneResumed(P, C), exit(C), exit(P));

test('head: the child keeps its own chdir and inherits the parent folder when logged before the clone returns', async (t) => {
  const writesUnder = await headWritesUnder();
  const a = writesUnder(withChdir, ROOT, START);
  const b = writesUnder(noChdir, ROOT, START);
  t.diagnostic(`with chdir: ${JSON.stringify(paths(a))}; without: ${JSON.stringify(paths(b))}`);
  assert.deepEqual(paths(a), [`${ROOT}/p/sub/made`]);
  assert.deepEqual(a.map((h) => h.pid), [C]);
  assert.deepEqual(paths(b), [`${ROOT}/p/m2`]);
  assert.deepEqual(b.map((h) => h.pid), [C]);
});
}

{
const ROOT = '/vroot';
const P = 5200, C = 5201;

test('head: a child logged after the clone returns resolves against the parent folder at the clone', async (t) => {
  const writesUnder = await headWritesUnder();
  const tr = trace(chdir(P, `${ROOT}/p`), cloneWhole(P, C), chdir(P, `${ROOT}/q`), mkdir(C, 'm3'), mkdir(P, 'pm'),
    exit(C), exit(P));
  const hits = writesUnder(tr, ROOT, '/vstart');
  t.diagnostic(JSON.stringify(hits.map(({ pid, path }) => ({ pid, path }))));
  assert.deepEqual(hits.filter((h) => h.pid === C).map((h) => h.path), [`${ROOT}/p/m3`]);
  assert.ok(!paths(hits).includes(`${ROOT}/q/m3`));
  // The parent's own later write follows its own chdir.
  assert.deepEqual(hits.filter((h) => h.pid === P).map((h) => h.path), [`${ROOT}/q/pm`]);
});

test('head: a pid no logged clone returned resolves against the start folder', async (t) => {
  const writesUnder = await headWritesUnder();
  const start = `${ROOT}/s`;
  const tr = trace(chdir(P, `${ROOT}/p`), cloneWhole(P, C), mkdir(6300, 'orphan'), exit(C), exit(P));
  const hits = writesUnder(tr, ROOT, start);
  t.diagnostic(JSON.stringify(hits.map(({ pid, path }) => ({ pid, path }))));
  assert.deepEqual(hits.filter((h) => h.pid === 6300).map((h) => h.path), [`${start}/orphan`]);
});
}
