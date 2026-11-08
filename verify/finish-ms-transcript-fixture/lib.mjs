// Verifier's helpers for plan item finish-ms-transcript-fixture, written from its Expect lines and Verifier brief.
// pinned() returns a temp bare repo holding the PR's base and head commits. It fetches them from this checkout when
// it has them, else from GitHub at depth 1 (borrowing actions/checkout's extraheader), so this checkout's .git is
// never written. headCopy() clones the head into a temp folder.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
/** The build head the verdict names. */
export const HEAD = 'c21887e36730ee64dd83476fcd73fbb510c5889c';
/** main at the PR's base, before the readying replan. */
export const BASE = '7a1190f17f0370382605ff34f3acde0a9cc21892';
export const TEST = 'plugins/harness/test/finish-ms.test.mjs';
export const EVIDENCE = 'verify/probe-plugin-agents-thread/evidence';
export const FIXTURE = 'test/regression/fixtures/agent-transcript.jsonl';

const ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };
export const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', maxBuffer: 1e8,
  env: { ...process.env, ...ENV }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000 }).trim();
const has = (dir, sha) => { try { git(dir, 'cat-file', '-e', `${sha}^{commit}`); return true; } catch { return false; } };
export const temp = (prefix) => {
  const d = mkdtempSync(join(tmpdir(), `${prefix}${process.pid}-`));
  process.on('exit', () => rmSync(d, { recursive: true, force: true }));
  return d;
};

let made;
export function pinned() {
  if (made) return made;
  const dir = temp('fmtf-pinned-');
  git(dir, 'init', '-q', '--bare');
  const refs = [HEAD, BASE].map((s, i) => `${s}:refs/heads/p${i}`);
  if ([HEAD, BASE].every((s) => has(REPO, s))) git(dir, 'fetch', '-q', '--depth=1', `file://${REPO}`, ...refs);
  else {
    const auth = (() => { try { return git(REPO, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
      .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
    git(dir, ...auth, 'fetch', '-q', '--depth=1', git(REPO, 'remote', 'get-url', 'origin'), ...refs);
  }
  return (made = dir);
}

/** A depth-1 clone of the head in a fresh temp folder (finish-ms's helpers need a git work tree), node_modules borrowed from this checkout. */
export function headCopy() {
  const dir = temp('fmtf-head-');
  git(tmpdir(), 'clone', '-q', '--depth=1', '--branch', 'p0', `file://${pinned()}`, dir);
  assert.equal(git(dir, 'rev-parse', 'HEAD'), HEAD);
  if (existsSync(join(REPO, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}
