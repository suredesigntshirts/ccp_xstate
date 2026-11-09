// Shared by the regression-folder-rules suite: the shas it checked, a copy of the head's code to break, and a run of
// the guard in that copy.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
/** The PR's merge base with main, and the head verified. */
export const BASE = '89516787a1cf8f1d090aa7c288033fbc3bc13cf8';
export const VERIFIED = '58725ca4e18d35a7b6375b910092dc0d2e753714';
export const GUARD = 'test/regression-rules.test.mjs';

/** A copy of the folders the guard reads (node_modules left out), removed after the test. */
export function copyHead(t) {
  const dir = mkdtempSync(join(tmpdir(), 'rfr-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'test', 'scripts', 'packages', 'plugins', 'infra', 'package.json'])
    if (existsSync(join(REPO, p))) cpSync(join(REPO, p), join(dir, p), { recursive: true, verbatimSymlinks: true, filter: (s) => !s.includes('node_modules') });
  return dir;
}

/** node --test of the guard in `dir`: exit status and its whole output. */
export function runGuard(dir) {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const t0 = process.hrtime.bigint();
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', GUARD], { cwd: dir, env, encoding: 'utf8', timeout: 60000 });
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  return { status: r.status, out: r.stdout + r.stderr, ms };
}
