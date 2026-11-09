// Shared by this folder's tests: the checkout under test, a copy of its tracked files, and a toy git repo.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const REPO = join(import.meta.dirname, '..', '..');
export const tmp = (name) => mkdtempSync(join(tmpdir(), `vot-${name}-`));

/** The checkout's tracked files as they are on disk, copied into a new folder (no .git, no node_modules). */
export function copyTracked(name) {
  const dest = tmp(name);
  execFileSync('sh', ['-c', `cd "${REPO}" && git ls-files -z | tar --null -T - -cf - | tar -xf - -C "${dest}"`]);
  return dest;
}

export const gitIn = (cwd, env = {}) => (...args) => execFileSync('git', ['-C', cwd, ...args], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', ...env }
}).trim();

export function write(cwd, path, text) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}

/** Commits everything in `cwd` unsigned, with an optional Claude-Session trailer; returns the sha. */
export function commit(cwd, message, session) {
  const git = gitIn(cwd);
  git('add', '-A');
  git('-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm',
    session ? `${message}\n\nClaude-Session: ${session}` : message);
  return git('rev-parse', 'HEAD');
}
