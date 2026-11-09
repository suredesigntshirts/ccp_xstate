// same-bars: the cheap test's name and body, and the files it measures with, are the base's.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, CAPTURE, CHEAP, ROOT, blob, cheapBlock, sha256 } from './lib.mjs';

test("the cheap test's block in capture.test.mjs is the base's, byte for byte", () => {
  const block = cheapBlock(readFileSync(join(ROOT, CAPTURE), 'utf8'));
  assert.ok(block.startsWith(`test('${CHEAP}', () => {\n`));
  assert.equal(sha256(block), BASE.cheapBlock);
  assert.match(block, /at\(0\.5\) - node\(0\.5\) <= 50,/);
  assert.match(block, /at\(0\.95\) - node\(0\.95\) <= 200,/);
});

test('capture.test.mjs, its helpers and capture.mjs are the base blobs', () => {
  for (const [file, id] of Object.entries(BASE.blobs)) assert.equal(blob(file), id, file);
});
