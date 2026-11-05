import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

const file = (text) => {
  const f = join(mkdtempSync(join(tmpdir(), 'cfg-')), 'config.json');
  writeFileSync(f, text);
  return f;
};

test('reads a config', () => assert.deepEqual(loadConfig(file('{"port": 9000}')), { port: 9000 }));
test('bad JSON throws', () => assert.throws(() => loadConfig(file('{port: 9000')), SyntaxError));
