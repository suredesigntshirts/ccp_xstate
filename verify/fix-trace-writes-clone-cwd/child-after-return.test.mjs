// child-after-return: the clone returns first, the parent moves on, and only then the child logs; and a pid with no
// logged clone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chdir, cloneWhole, exit, headWritesUnder, mkdir, paths, trace } from './lib.mjs';

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
