import test from 'node:test';
import assert from 'node:assert/strict';
import { capitalize, slugify, truncate } from '../index.js';

test('capitalize', () => assert.equal(capitalize('abc'), 'Abc'));
test('slugify', () => assert.equal(slugify(' Hello World! '), 'hello-world'));
test('truncate', () => {
  assert.equal(truncate('abcdef', 4), 'abc\u2026');
  assert.equal(truncate('ab', 4), 'ab');
});
