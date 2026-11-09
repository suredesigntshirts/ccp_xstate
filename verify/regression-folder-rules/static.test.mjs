// The guard reads files only: it imports no child_process, worker or network module and names no clone or spawn, and
// a whole node --test run of it takes under two seconds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARD, REPO, copyHead, runGuard } from './lib.mjs';

test('the guard imports only node:test, node:assert, node:fs and node:path', () => {
  const src = readFileSync(join(REPO, GUARD), 'utf8');
  const imports = [...src.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ['node:assert/strict', 'node:fs', 'node:path', 'node:test']);
  assert.doesNotMatch(src, /\brequire\(|\bimport\(/, 'no dynamic or CommonJS import');
  assert.doesNotMatch(src, /child_process|worker_threads|\bfetch\(|mkdtemp|writeFileSync/, 'no child process, fetch or write');
});

test('a node --test run of the guard takes under two seconds', (t) => {
  const dir = copyHead(t);
  const runs = [0, 1, 2].map(() => runGuard(dir));
  for (const r of runs) assert.equal(r.status, 0, r.out);
  const worst = Math.max(...runs.map((r) => r.ms));
  assert.ok(worst < 2000, `slowest of three runs ${worst.toFixed(0)} ms`);
});
