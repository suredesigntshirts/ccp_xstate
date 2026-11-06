// Expect deps (plan item prompt-catalogue): test/workspaces.test.mjs fails a workspace whose runtime dependency no
// plan/decisions/ file names and passes with xstate and mustache; CLAUDE.md and docs/layout.md state the new rule.
// Method: copy the test, every workspace package.json and plan/decisions/ into a scratch folder, change the copy,
// and run the real test file there with node --test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

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
// NODE_TEST_CONTEXT is dropped so the child reports on its own stdout and exit code, not to this runner.
const run = (dir) => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--test', 'test/workspaces.test.mjs'], { cwd: dir, encoding: 'utf8', env });
};
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

test('deps: CLAUDE.md and docs/layout.md state the new rule, and no longer the xstate-only one', () => {
  const claude = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
  const layout = readFileSync(join(REPO, 'docs', 'layout.md'), 'utf8');
  assert.match(claude, /runtime dependency needs a `plan\/decisions\/` file naming it/i);
  assert.doesNotMatch(claude, /Zero runtime dependencies except/);
  assert.match(layout, /A runtime dependency is allowed when a file in `plan\/decisions\/` names it/);
  assert.doesNotMatch(layout, /No runtime dependency except `xstate`/);
  assert.ok(claude.split('\n').length < 100, 'CLAUDE.md stays under 100 lines');
});
