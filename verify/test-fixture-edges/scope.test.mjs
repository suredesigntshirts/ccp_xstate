// scope: the build PR's files between its base (main after the ready replan merged) and the verified head.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const BASE = '66e47a6a5417484a3da9947148fcb25de73e6738';
const HEAD = 'af64a367c242b66cf968aad168b40e5141d029a3';
const ALLOWED = ['test/setup.test.mjs', 'verify/self-update-by-version/no-self-edit.test.mjs', 'scripts/debug/trace-writes.mjs',
  'scripts/debug/trace-writes.test.mjs', 'plugins/harness/test/capture.test.mjs', 'plan/decisions/2026-11-08-capture-p95-over-bare-start.md',
  'plan/items/test-fixture-edges.md'];
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const have = (sha) => { try { git('cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };

test('the PR changes only the files the item names', (t) => {
  // ci checks out at depth 1, so fetch the two commits when they are not here.
  for (const sha of [BASE, HEAD]) if (!have(sha)) git('fetch', '-q', '--depth=1', 'origin', sha);
  const files = git('diff', '--name-only', BASE, HEAD).split('\n').filter(Boolean);
  t.diagnostic(files.join(', '));
  assert.ok(files.length > 0);
  assert.deepEqual(files.filter((f) => !ALLOWED.includes(f)), []);
  assert.deepEqual(files.filter((f) => /^(packages|workflows)\//.test(f) || (f.startsWith('plugins/harness/') && !f.startsWith('plugins/harness/test/'))), []);
});
