// scope: the build PR's files between its base (main after the ready replan merged) and the verified head.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';

const BASE = '66e47a6a5417484a3da9947148fcb25de73e6738';
const HEAD = 'af64a367c242b66cf968aad168b40e5141d029a3';
const ALLOWED = ['test/setup.test.mjs', 'verify/self-update-by-version/no-self-edit.test.mjs', 'scripts/debug/trace-writes.mjs',
  'scripts/debug/trace-writes.test.mjs', 'plugins/harness/test/capture.test.mjs', 'plan/decisions/2026-11-08-capture-p95-over-bare-start.md',
  'plan/items/test-fixture-edges.md'];
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

test('the PR changes only the files the item names', (t) => {
  // ci checks out at depth 1, so the two commits are fetched into a temp repo when they are not here.
  const dir = pinnedRepo(ROOT, [BASE, HEAD]);
  assert.ok(dir, 'base and head commits readable');
  const files = execFileSync('git', ['-C', dir, 'diff', '--name-only', BASE, HEAD], { encoding: 'utf8' }).split('\n').filter(Boolean);
  t.diagnostic(files.join(', '));
  assert.ok(files.length > 0);
  assert.deepEqual(files.filter((f) => !ALLOWED.includes(f)), []);
  assert.deepEqual(files.filter((f) => /^(packages|workflows)\//.test(f) || (f.startsWith('plugins/harness/') && !f.startsWith('plugins/harness/test/'))), []);
});
