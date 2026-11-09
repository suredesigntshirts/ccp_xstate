// Expect: faster-nested-test-runs/no-leak
// After the changed test files run, the checkout's git status, branches and worktrees are as before, nothing was added
// beside it, and no file in it was written. The three files that wrote in or beside the checkout at the base
// (bin.test.js, standin.test.js, setup-install.test.mjs) run here in a lean clone of the head; the rest are read from
// record.mjs's runs in evidence/no-leak.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FILES, REPO, VERIFIED, evidence } from './lib.mjs';

const RUN_HERE = ['packages/engine/test/bin.test.js', 'packages/engine/test/standin.test.js', 'test/regression/plugin/setup-install.test.mjs'];
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' };
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', env }).trim();

function snapshot(repo) {
  const files = git(repo, 'ls-files', '-z').split('\0').filter(Boolean);
  return {
    status: git(repo, 'status', '--porcelain', '--untracked-files=all'),
    branches: git(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/'),
    worktrees: git(repo, 'worktree', 'list', '--porcelain'),
    parent: readdirSync(join(repo, '..')).sort(),
    written: Object.fromEntries(files.map((f) => { try { const s = statSync(join(repo, f)); return [f, `${s.mtimeMs}:${s.ino}`]; } catch { return [f, 'gone']; } })),
  };
}

test('bin.test.js, standin.test.js and setup-install.test.mjs leave the checkout and its parent as they were', (t) => {
  const parent = mkdtempSync(join(tmpdir(), 'fntr-leak-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const c = join(parent, 'repo');
  execFileSync('git', ['clone', '-q', '--no-checkout', REPO, c], { env });
  git(c, 'checkout', '-q', 'HEAD');
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  writeFileSync(join(c, '.git', 'info', 'exclude'), 'node_modules\n', { flag: 'a' });
  const before = snapshot(c);
  for (const f of RUN_HERE) {
    const { NODE_TEST_CONTEXT, ...clean } = process.env;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', f], { cwd: c, env: clean, encoding: 'utf8', timeout: 600000 });
    assert.equal(r.status, 0, `${f}: ${r.stdout.slice(-2000)}${r.stderr.slice(-1000)}`);
  }
  const after = snapshot(c);
  for (const k of ['status', 'branches', 'worktrees', 'parent']) assert.deepEqual(after[k], before[k], k);
  const written = Object.keys(before.written).filter((f) => after.written[f] !== before.written[f]);
  assert.deepEqual(written, [], 'no tracked file written');
});

test('record.mjs runs: no changed file at the head left a branch, a worktree, a status change or a folder beside it', () => {
  const e = evidence('no-leak');
  assert.equal(e.head, VERIFIED);
  assert.deepEqual(Object.keys(e.headLeaks).sort(), [...FILES].sort());
  for (const f of FILES) assert.deepEqual(e.headLeaks[f], [], f);
});
