// no-install: npm test in a copy without node_modules stops within seconds with one line naming npm ci and starts no
// test file; with node_modules present it goes past the check and test files start reporting.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { childEnv } from '../../test/regression/lib.mjs';
import { REPO, copyTracked } from './lib.mjs';

test('without node_modules npm test stops at once with one line saying to run npm ci', () => {
  const dir = copyTracked('noinst');
  assert.equal(existsSync(join(dir, 'node_modules')), false);
  const t0 = Date.now();
  const r = spawnSync('npm', ['test'], { cwd: dir, env: childEnv(), encoding: 'utf8', timeout: 60000 });
  const ms = Date.now() - t0;
  assert.notEqual(r.status, 0);
  assert.ok(ms < 10000, `took ${ms} ms`);
  const own = r.stderr.split('\n').filter((l) => l && !/^npm (error|ERR!|warn)/.test(l));
  assert.deepEqual(own, ['npm test: node_modules is not installed here; run npm ci first, then npm test again']);
  const all = r.stdout + r.stderr;
  assert.doesNotMatch(all, /node --test --test-skip-pattern/, 'the test script never started');
  assert.doesNotMatch(all, /^# tests|ℹ tests|✔|✖|^ok |^not ok /m, 'no test file reported');
  assert.match(r.stdout, /> node scripts\/ci\/installed\.mjs/, 'the check is what ran');
});

test('with node_modules present npm test goes past the check and test files report', async () => {
  const dir = copyTracked('inst');
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  const child = spawn('npm', ['test'], { cwd: dir, env: childEnv(), detached: true });
  let out = '';
  const seen = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), 120000);
    const on = (b) => { out += b; if (/✔|^ok \d/m.test(out)) { clearTimeout(timer); resolve(true); } };
    child.stdout.on('data', on);
    child.stderr.on('data', on);
    child.on('exit', () => { clearTimeout(timer); resolve(/✔|^ok \d/m.test(out)); });
  });
  try { process.kill(-child.pid, 'SIGKILL'); } catch {}
  assert.ok(seen, out.slice(0, 2000));
  assert.match(out, /node --test --test-skip-pattern/);
  assert.doesNotMatch(out, /node_modules is not installed/);
});
