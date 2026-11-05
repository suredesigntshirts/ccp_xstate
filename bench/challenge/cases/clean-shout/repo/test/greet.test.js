import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { greeting } from '../src/greet.js';

test('greeting', () => assert.equal(greeting('Ada'), 'Hello, Ada!'));
test('cli', () => assert.equal(execFileSync('node', ['bin/greet.js', 'Ada'], { encoding: 'utf8' }), 'Hello, Ada!\n'));
