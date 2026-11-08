// Shared helpers for this item's verifier tests: temp clones of the checkout these tests sit in, at the head or with
// the build's change taken back out (to-base.diff, the reverse of the build commit for the four code files).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(HERE, '..', '..');

const ID = ['-c', 'user.name=verifier', '-c', 'user.email=verifier@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false'];
const GENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

export const git = (dir, ...args) => execFileSync('git', [...ID, '-C', dir, ...args], { encoding: 'utf8', env: GENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const made = [];
export function temp(name) {
  const d = mkdtempSync(join(tmpdir(), `verify-tfe-${name}-`));
  made.push(d);
  return d;
}
export function cleanup() {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
}

/** A clone of this checkout's HEAD; `base` takes the build's change back out and commits that. */
export function clone(name, { base = false } = {}) {
  const dir = join(temp(name), 'repo');
  execFileSync('git', ['clone', '-q', '--no-hardlinks', ROOT, dir], { env: GENV, stdio: 'ignore' });
  if (existsSync(join(ROOT, 'node_modules'))) symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  if (base) {
    git(dir, 'apply', join(HERE, 'to-base.diff'));
    git(dir, 'commit', '-q', '-am', 'base: the build change taken out');
  }
  return dir;
}

/** Replaces exactly one occurrence of `from` in `file` under `dir`. */
export function edit(dir, file, from, to) {
  const p = join(dir, file);
  const text = readFileSync(p, 'utf8');
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${file}: expected one '${from}', found ${n}`);
  writeFileSync(p, text.replace(from, to));
}

/** node --test with the TAP reporter in `dir`; the counts and the failing test names. */
export function nodeTest(dir, files, { pattern, env = process.env, timeout = 600_000 } = {}) {
  env = { ...env };
  delete env.NODE_TEST_CONTEXT; // else the child reports to this runner, not as TAP
  const args = ['--test', '--test-reporter=tap', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...files];
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', env, timeout, maxBuffer: 64 << 20 });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = (k) => Number(out.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? NaN);
  const failed = [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { status: r.status, pass: count('pass'), fail: count('fail'), skipped: count('skipped'), failed, out };
}
