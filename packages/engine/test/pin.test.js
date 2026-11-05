// The pin (lane A, 4.3; engine-stage-contract): loadWorkflow('name@<sha256>', { root }) reads the bytes stored under
// root and checks their hash. When the root never stored them, it takes them from the workflow file only if that file
// hashes to the pin exactly; an edited file is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, readWorkflow } from '../src/index.js';

// The bytes quick-fix is pinned as (its JSON with its stage files filled in): written as one file, they pin the same.
const QF = readWorkflow('quick-fix', { dir: new URL('../../../workflows/', import.meta.url).pathname }).bytes;
const hash = (b) => createHash('sha256').update(b).digest('hex');

test('a pinned id loads from the stored blob, and a missing blob is stored from a file with exactly the pinned bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'pin-'));
  const dir = join(root, 'wf');
  mkdirSync(dir);
  writeFileSync(join(dir, 'quick-fix.json'), QF);
  const id = `quick-fix@${hash(QF)}`;
  assert.ok(!existsSync(join(root, 'blobs', hash(QF))));
  assert.equal(loadWorkflow(id, { root, dir }).id, id);
  assert.equal(readFileSync(join(root, 'blobs', hash(QF)), 'utf8'), QF.toString('utf8'), 'stored from the matching file');
  // From the stored blob now, whatever the file says.
  writeFileSync(join(dir, 'quick-fix.json'), QF.toString('utf8').replace('Merge this PR', 'Ship this PR'));
  assert.equal(loadWorkflow(id, { root, dir }).id, id);
});

test('a missing blob is not taken from an edited file: the load fails', () => {
  const root = mkdtempSync(join(tmpdir(), 'pin-'));
  const dir = join(root, 'wf');
  mkdirSync(dir);
  writeFileSync(join(dir, 'quick-fix.json'), QF.toString('utf8').replace('Merge this PR', 'Ship this PR'));
  assert.throws(() => loadWorkflow(`quick-fix@${hash(QF)}`, { root, dir }), /ENOENT/);
  assert.ok(!existsSync(join(root, 'blobs', hash(QF))));
});
