// Expect node-only: names.js imports only node: modules, and loads from a copy of packages/engine/src with no
// node_modules (so no xstate) anywhere above it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO } from './lib.mjs';

test('node-only: names.js imports only node: built-ins', () => {
  const text = readFileSync(join(REPO, 'packages', 'engine', 'src', 'names.js'), 'utf8');
  const specs = [...text.matchAll(/\bimport\s*(?:[^'"]*?from\s*)?['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]|\brequire\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2] ?? m[3]);
  assert.ok(specs.length > 0);
  assert.deepEqual(specs.filter((s) => !s.startsWith('node:')), [], `imports: ${specs.join(', ')}`);
});

test('node-only: names.js loads with xstate absent; host.js there does not (control)', async () => {
  const dir = join(mkdtempSync(join(tmpdir(), 'verify-rn-node-')), 'src');
  cpSync(join(REPO, 'packages', 'engine', 'src'), dir, { recursive: true });
  for (let d = dir; d !== dirname(d); d = dirname(d)) assert.ok(!existsSync(join(d, 'node_modules')), `no node_modules at ${d}`);
  const n = await import(pathToFileURL(join(dir, 'names.js')).href);
  for (const k of ['runId', 'runOf', 'safe', 'itemFile', 'sessionFile', 'runsDir', 'runDir', 'cardFile', 'closedFile', 'agentFile', 'spawnFile', 'resultHash']) assert.equal(typeof n[k], 'function', k);
  assert.deepEqual(n.runOf(n.runId('it/1', '3.build')), { item: 'it/1', name: '3.build' });
  await assert.rejects(import(pathToFileURL(join(dir, 'host.js')).href), /xstate/);
});
