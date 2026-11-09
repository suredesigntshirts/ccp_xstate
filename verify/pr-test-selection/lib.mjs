// Shared by this folder's tests: the head checkout, its selector, and a throwaway git repo to run the selector over.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const selector = await import(join(REPO, 'scripts', 'ci', 'select-tests.mjs'));

/** A git repo in a temp folder: write(), remove(), move() edit its tree, commit() returns the new sha. */
export function tempRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'pr-test-selection-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=v', '-c', 'user.email=v@example.com',
    '-c', 'commit.gpgsign=false', ...a], { encoding: 'utf8', env: { PATH: process.env.PATH, GIT_CONFIG_GLOBAL: '/dev/null', HOME: dir } }).trim();
  git('init', '-q', '-b', 'main');
  return {
    dir,
    write(p, text) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); },
    remove(p) { rmSync(join(dir, p)); },
    move(a, b) { mkdirSync(dirname(join(dir, b)), { recursive: true }); renameSync(join(dir, a), join(dir, b)); },
    commit(msg) { git('add', '-A'); git('commit', '-q', '-m', msg); return git('rev-parse', 'HEAD'); },
  };
}

/** The selector's answer for base..head in `repo`: 'ALL' or the selected guard files. */
export function pick(base, head, repo) {
  const r = selector.select(selector.changedFiles(base, head, repo), { repo });
  return r.all ? 'ALL' : r.files.map((f) => f.file);
}
