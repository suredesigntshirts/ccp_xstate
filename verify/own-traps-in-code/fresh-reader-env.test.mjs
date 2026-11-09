// fresh-reader-env: a stub claude first on PATH records what scripts/fresh-reader.mjs starts it with, from a caller
// environment that sets every thread variable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { childEnv } from '../../test/regression/lib.mjs';
import { REPO, tmp, write } from './lib.mjs';

const THREAD = ['CLAUDE_CODE_REMOTE_SESSION_ID', 'CLAUDE_MEMORY_STORES', 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE',
  'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD', 'CLAUDE_ADDITIONAL_DIRECTORIES'];

function run(args) {
  const dir = tmp('reader');
  const bin = join(dir, 'bin');
  const log = join(dir, 'seen.json');
  write(dir, 'bin/claude', `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(log)}.argv\ncat > ${JSON.stringify(log)}.stdin\nenv -0 > ${JSON.stringify(log)}.env\npwd > ${JSON.stringify(log)}.cwd\necho reader-answer\n`);
  chmodSync(join(bin, 'claude'), 0o755);
  const home = join(dir, 'caller-home');
  const harness = join(dir, 'caller-harness');
  write(dir, 'caller-home/.claude/CLAUDE.md', 'codeword: caller-only\n');
  mkdirSync(harness);
  writeFileSync(join(harness, 'keep'), '');
  const caller = { PATH: `${bin}:${process.env.PATH}`, HOME: home, CCP_HARNESS_DIR: harness, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
    ...Object.fromEntries(THREAD.map((k) => [k, `caller-${k}`])) };
  const r = spawnSync(process.execPath, [join(REPO, 'scripts', 'fresh-reader.mjs'), ...args], { cwd: dir, env: childEnv({ add: caller }), encoding: 'utf8' });
  const env = Object.fromEntries(readFileSync(`${log}.env`, 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
  return { r, dir, home, harness, env, argv: readFileSync(`${log}.argv`, 'utf8').split('\n').slice(0, -1),
    stdin: readFileSync(`${log}.stdin`, 'utf8'), cwd: readFileSync(`${log}.cwd`, 'utf8').trim() };
}

test('the reader gets claude -p with the prompt on stdin, an empty HOME and harness folder of its own, memory off, no thread keys', () => {
  const clone = tmp('clone');
  const s = run(['--cwd', clone, 'What is the codeword? `backticks` and $HOME stay literal']);
  assert.equal(s.r.status, 0, s.r.stderr);
  assert.equal(s.r.stdout, 'reader-answer\n');
  assert.deepEqual(s.argv, ['-p']);
  assert.equal(s.stdin, 'What is the codeword? `backticks` and $HOME stay literal');
  assert.equal(s.cwd, clone);
  for (const k of THREAD) assert.equal(k in s.env, false, `${k} is not passed`);
  assert.equal(s.env.CLAUDE_CODE_DISABLE_AUTO_MEMORY, '1');
  assert.notEqual(s.env.HOME, s.home);
  assert.notEqual(s.env.CCP_HARNESS_DIR, s.harness);
  assert.deepEqual(readdirSync(s.env.HOME), []);
  assert.deepEqual(readdirSync(s.env.CCP_HARNESS_DIR), []);
  assert.notEqual(s.env.HOME, s.env.CCP_HARNESS_DIR);
  assert.equal(s.env.NODE_TEST_CONTEXT, undefined);
  assert.deepEqual(readdirSync(s.harness), ['keep'], 'the caller harness folder is untouched');
});

test('extra claude args after -- follow -p, and two runs get two different empty folders', () => {
  const a = run(['hi', '--', '--allowedTools', 'Read,Grep', '--model', 'x']);
  const b = run(['hi']);
  assert.deepEqual(a.argv, ['-p', '--allowedTools', 'Read,Grep', '--model', 'x']);
  assert.equal(a.stdin, 'hi');
  assert.notEqual(a.env.HOME, b.env.HOME);
  assert.notEqual(a.env.CCP_HARNESS_DIR, b.env.CCP_HARNESS_DIR);
});
