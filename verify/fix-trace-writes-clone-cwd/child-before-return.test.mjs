// child-before-return: a child's own chdir and relative mkdir logged before the parent's clone returns its pid.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseWritesUnder, chdir, cloneResumed, cloneStart, exit, headWritesUnder, mkdir, paths, trace } from './lib.mjs';

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

test('base: the same two traces report neither path', async (t) => {
  const writesUnder = await baseWritesUnder(t);
  if (!writesUnder) return t.skip('the base commit cannot be read or fetched in this checkout');
  const a = writesUnder(withChdir, ROOT, START);
  const b = writesUnder(noChdir, ROOT, START);
  t.diagnostic(`base with chdir: ${JSON.stringify(paths(a))}; without: ${JSON.stringify(paths(b))}`);
  assert.ok(!paths(a).includes(`${ROOT}/p/sub/made`));
  assert.ok(!paths(b).includes(`${ROOT}/p/m2`));
});
