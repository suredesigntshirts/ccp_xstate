// Expect suite-and-scope, scope half: the PR changes only the files its outputs name and its own item file, and no
// other item file. The two commits are pinned; when this checkout lacks either (ci.yml checks out at depth 1), they are
// fetched at depth 1 into a temp bare repo, which is enough to compare their trees. The suite half is run by hand and
// recorded in evidence/suite-and-scope.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, splitItem } from './lib.mjs';

/** The build head verified, and the PR's base: main's commit the branch starts from (merge of #212). */
const HEAD = 'ec2090105e18670277bb2e4f513c909508edef64';
const BASE = 'a4e3a59d151bcea666621a7bd9024fc14d410378';
const ITEM = 'plan/items/item-head-trim.md';

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1e8,
  stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const has = (dir, sha) => { try { git(dir, 'cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };

function objects(t) {
  if (has(REPO, HEAD) && has(REPO, BASE)) return REPO;
  const dir = mkdtempSync(join(tmpdir(), 'iht-objects-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
  const auth = (() => { try { return git(REPO, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  git(REPO, 'init', '-q', '--bare', dir);
  execFileSync('git', [...auth, 'fetch', '-q', '--depth=1', git(REPO, 'remote', 'get-url', 'origin'), HEAD, BASE],
    { cwd: dir, stdio: 'ignore', timeout: 300_000 });
  return dir;
}

test('the build changes only the files its outputs name and its own item file', (t) => {
  const G = objects(t);
  const changed = git(G, 'diff', '--name-only', '--no-renames', BASE, HEAD).split('\n').filter(Boolean).sort();
  const { head } = splitItem(git(G, 'show', `${HEAD}:${ITEM}`));
  const named = new Set(head.outputs.flatMap((o) => o.ref.split(',').map((s) => s.trim())));
  t.diagnostic(`${BASE.slice(0, 8)}..${HEAD.slice(0, 8)}: ${changed.join(', ')}`);
  t.diagnostic(`outputs: ${[...named].join(', ')}`);
  assert.deepEqual(changed.filter((p) => p !== ITEM && !named.has(p)), []);
  assert.deepEqual(changed.filter((p) => p.startsWith('plan/items/')), [ITEM]);
  assert.ok(changed.length > 1);
});
