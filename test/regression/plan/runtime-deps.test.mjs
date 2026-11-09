// Expect: prompt-catalogue/deps
// test/workspaces.test.mjs, run on a scratch copy of the workspaces' package.json files and plan/decisions/: it passes the
// workspaces as they are, fails an unnamed runtime dependency in a package or a plugin, and passes once a plan/decisions/
// file names it with a Runtime dependency line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { childEnv } from '../lib.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

function scratch() {
  const dir = mkdtempSync(join(tmpdir(), 'verify-pc-deps-'));
  mkdirSync(join(dir, 'test'));
  cpSync(join(REPO, 'test', 'workspaces.test.mjs'), join(dir, 'test', 'workspaces.test.mjs'));
  cpSync(join(REPO, 'package.json'), join(dir, 'package.json'));
  cpSync(join(REPO, 'plan', 'decisions'), join(dir, 'plan', 'decisions'), { recursive: true });
  for (const top of ['packages', 'plugins']) {
    for (const w of readdirSync(join(REPO, top))) {
      if (!existsSync(join(REPO, top, w, 'package.json'))) continue;
      mkdirSync(join(dir, top, w), { recursive: true });
      cpSync(join(REPO, top, w, 'package.json'), join(dir, top, w, 'package.json'));
    }
  }
  return dir;
}
const run = (dir) => spawnSync(process.execPath, ['--test', 'test/workspaces.test.mjs'], { cwd: dir, encoding: 'utf8', env: childEnv() });
const setDep = (dir, ws, name, version) => {
  const f = join(dir, ws, 'package.json');
  const pkg = JSON.parse(readFileSync(f, 'utf8'));
  pkg.dependencies = { ...(pkg.dependencies ?? {}), [name]: version };
  writeFileSync(f, JSON.stringify(pkg, null, 2));
};

test('deps: the workspaces as they are (xstate and mustache) pass', () => {
  const dir = scratch();
  const deps = JSON.parse(readFileSync(join(dir, 'packages', 'engine', 'package.json'), 'utf8')).dependencies;
  assert.ok(deps.xstate && deps.mustache, JSON.stringify(deps));
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /# pass [1-9]/);
  assert.match(r.stdout, /# fail 0/);
});

test('deps: an unnamed runtime dependency fails the test, in a package and in a plugin', () => {
  for (const ws of ['packages/engine', 'plugins/harness']) {
    const dir = scratch();
    setDep(dir, ws, 'left-pad', '1.3.0');
    const r = run(dir);
    assert.notEqual(r.status, 0, `${ws}: ${r.stdout}`);
    assert.match(r.stdout, /left-pad/);
  }
});

test('deps: a prose mention does not name it; a "Runtime dependency" line in plan/decisions does', () => {
  const dir = scratch();
  setDep(dir, 'packages/journal', 'left-pad', '1.3.0');
  writeFileSync(join(dir, 'plan', 'decisions', '2026-11-06-zz-mention.md'), '# x\n\nWe looked at `left-pad` and liked it.\n');
  assert.notEqual(run(dir).status, 0);
  appendFileSync(join(dir, 'plan', 'decisions', '2026-11-06-zz-mention.md'), '\nRuntime dependency: `left-pad`\n');
  const r = run(dir);
  assert.equal(r.status, 0, r.stdout);
});

test('deps: dropping the mustache record fails the test with mustache still a dependency', () => {
  const dir = scratch();
  for (const f of readdirSync(join(dir, 'plan', 'decisions'))) {
    const p = join(dir, 'plan', 'decisions', f);
    writeFileSync(p, readFileSync(p, 'utf8').replaceAll('Runtime dependency: `mustache`', 'mustache was chosen'));
  }
  const r = run(dir);
  assert.notEqual(r.status, 0);
  assert.match(r.stdout, /mustache/);
});

