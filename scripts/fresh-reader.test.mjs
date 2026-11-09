// The fresh reader's claude -p call, seen by a stub claude first on PATH that records its arguments, stdin and
// environment.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { childEnv } from '../test/regression/lib.mjs';
import { THREAD_KEYS } from './fresh-reader.mjs';

const SCRIPT = join(import.meta.dirname, 'fresh-reader.mjs');

function run(args, extra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'fresh-reader-test-'));
  const bin = join(dir, 'bin');
  const seen = join(dir, 'seen.json');
  spawnSync('mkdir', [bin]);
  writeFileSync(join(bin, 'claude'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(seen)}, JSON.stringify({ argv: process.argv.slice(2), stdin: fs.readFileSync(0, 'utf8'), env: process.env, cwd: process.cwd() }));
console.log('answer');
`);
  chmodSync(join(bin, 'claude'), 0o755);
  const callerHome = join(dir, 'caller-home');
  const callerHarness = join(dir, 'caller-harness');
  spawnSync('mkdir', [callerHome, callerHarness]);
  const add = { PATH: `${bin}:${process.env.PATH}`, HOME: callerHome, CCP_HARNESS_DIR: callerHarness, ...Object.fromEntries(THREAD_KEYS.map((k) => [k, 'set'])), ...extra };
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: childEnv({ add }), encoding: 'utf8' });
  return { r, dir, callerHome, callerHarness, seen: r.status === 0 ? JSON.parse(readFileSync(seen, 'utf8')) : null };
}

test('the reader gets the prompt on stdin, an empty HOME and harness folder of its own, memory off, no thread keys', () => {
  const { r, seen, callerHome, callerHarness, dir } = run(['--cwd', tmpdir(), 'what does CLAUDE.md say?', '--', '--allowedTools', 'Read,Grep']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout, 'answer\n');
  assert.deepEqual(seen.argv, ['-p', '--allowedTools', 'Read,Grep']);
  assert.equal(seen.stdin, 'what does CLAUDE.md say?');
  assert.equal(seen.cwd, tmpdir());
  for (const key of ['CLAUDE_CODE_REMOTE_SESSION_ID', 'CLAUDE_MEMORY_STORES', 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE',
    'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD', 'CLAUDE_ADDITIONAL_DIRECTORIES']) assert.equal(seen.env[key], undefined, key);
  assert.equal(seen.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  for (const [key, caller] of [['HOME', callerHome], ['CCP_HARNESS_DIR', callerHarness]]) {
    assert.notEqual(seen.env[key], caller, key);
    assert.ok(!seen.env[key].startsWith(dir), `${key} is not beside the caller's`);
    assert.deepEqual(readdirSync(seen.env[key]), [], `${key} is empty`);
  }
  assert.deepEqual(readdirSync(callerHarness), []);
});

test('the reader runs in the folder it is started from by default, and refuses a call with no prompt', () => {
  const { r, seen, dir } = run(['hello']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(seen.cwd, dir);
  const none = run([]);
  assert.equal(none.r.status, 2);
  assert.match(none.r.stderr, /usage/);
});
