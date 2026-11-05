import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { parse } from '../src/parse.js';

test('parse', () => assert.deepEqual(parse('a,b\n1,2\n'), [{ a: '1', b: '2' }]));
test('cli', () => assert.equal(execFileSync('node', ['bin/csv2json.js'], { input: 'a,b\n1,2\n', encoding: 'utf8' }), '[{"a":"1","b":"2"}]\n'));
