// Verifier's helpers for plan item self-edit-check-snapshot, written from the item's Expect lines; the builder's
// tests under scripts/debug/ are not read or used. SECS_REPO names the checkout under test (default: this repo).
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.SECS_REPO ?? join(HERE, '..', '..'));
export const NO_SELF_EDIT = 'verify/self-update-by-version/no-self-edit.test.mjs';
export const SETUP_TEST = 'test/setup.test.mjs';

/** A temp folder removed when the test `t` ends. */
export function temp(t, name) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), `secs-${name}-`)));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

/** Git with no global config, so the container's commit signing and identity stay out. */
export function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, '-c', 'user.email=v@v', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
}

/** A clone of the checkout's HEAD at <dir>/repo. */
export function cloneHead(dir) {
  const c = join(dir, 'repo');
  execFileSync('git', ['clone', '-q', REPO, c], { stdio: 'ignore', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  return c;
}

/** Commit every change in a clone (so the tests' own clones of it see the change). */
export const commitAll = (c, msg) => { git(c, 'add', '-A'); git(c, 'commit', '-q', '-m', msg); };

/** node --test on one file in `cwd`, with `env` (defaults to this process's) and extra args; the summary parsed. */
export function nodeTest(cwd, file, { env = process.env, args = [] } = {}) {
  // A node --test inside a test file runs nothing unless the parent's test context is dropped.
  const { NODE_TEST_CONTEXT, ...clean } = env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...args, file], { cwd, env: clean, encoding: 'utf8', timeout: 540000 });
  const n = (k) => Number((r.stdout.match(new RegExp(`^# ${k} (\\d+)$`, 'm')) ?? [])[1] ?? NaN);
  return { status: r.status, out: r.stdout + r.stderr, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
}

/** The names of the failing tests in a TAP run. */
export const failing = (out) => [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);

/** A folder of links to every command on PATH except those named in `drop`, first found wins. */
export function pathWithout(dir, drop) {
  for (const d of (process.env.PATH ?? '').split(':').filter(Boolean)) {
    if (!existsSync(d)) continue;
    for (const n of readdirSync(d)) {
      if (drop.includes(n) || existsSync(join(dir, n))) continue;
      try { symlinkSync(join(d, n), join(dir, n)); } catch { /* a name seen twice */ }
    }
  }
  return dir;
}

/** True when `cmd` resolves on PATH `p`. */
export const onPath = (cmd, p) => spawnSync('bash', ['-c', `command -v ${cmd}`], { env: { ...process.env, PATH: p } }).status === 0;
