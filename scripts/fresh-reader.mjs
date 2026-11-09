#!/usr/bin/env node
// Starts claude -p as a reader that knows only the repository it runs in: an empty HOME (no container CLAUDE.md, no
// settings), auto memory off, none of the thread's memory stores or extra CLAUDE.md folders, its own session rather
// than the thread's, and an empty CCP_HARNESS_DIR of its own, so it writes nothing into the thread's journal. The
// prompt goes on stdin, since claude's --allowedTools takes every word after it.
//
//   node scripts/fresh-reader.mjs [--cwd <clone>] <prompt> [-- <more claude args>]
//
// Run it in a clean clone of the commit to read: the reader sees that folder's CLAUDE.md and files, nothing else.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** What a thread sets that would let a reader see past the repository or file its work under the thread. */
export const THREAD_KEYS = [
  'CLAUDE_CODE_REMOTE_SESSION_ID',
  'CLAUDE_MEMORY_STORES',
  'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE',
  'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD',
  'CLAUDE_ADDITIONAL_DIRECTORIES',
  'NODE_TEST_CONTEXT'
];

/** The reader's environment: `from` without THREAD_KEYS, with a new empty HOME and CCP_HARNESS_DIR and memory off. */
export function readerEnv(from = process.env) {
  const env = { ...from };
  for (const key of THREAD_KEYS) delete env[key];
  const top = mkdtempSync(join(tmpdir(), 'fresh-reader-'));
  const home = mkdtempSync(join(top, 'home-'));
  const harness = mkdtempSync(join(top, 'harness-'));
  return { ...env, HOME: home, CCP_HARNESS_DIR: harness, CLAUDE_CODE_DISABLE_AUTO_MEMORY: '1' };
}

/** Runs the reader in `cwd` and returns { status, stdout, stderr }. */
export function read(prompt, { cwd = process.cwd(), args = [], from = process.env } = {}) {
  const r = spawnSync('claude', ['-p', ...args], { cwd, env: readerEnv(from), input: prompt, encoding: 'utf8', maxBuffer: 64 << 20 });
  if (r.error) throw r.error;
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const split = argv.indexOf('--');
  const own = split < 0 ? argv : argv.slice(0, split);
  const args = split < 0 ? [] : argv.slice(split + 1);
  let cwd = process.cwd();
  const at = own.indexOf('--cwd');
  if (at >= 0) { cwd = own[at + 1]; own.splice(at, 2); }
  if (own.length !== 1) {
    console.error('usage: fresh-reader.mjs [--cwd <clone>] <prompt> [-- <more claude args>]');
    process.exit(2);
  }
  const r = read(own[0], { cwd, args });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exit(r.status ?? 1);
}
