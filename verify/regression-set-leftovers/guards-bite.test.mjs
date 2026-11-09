// guards-bite: the two new guards go red when the behaviour they guard breaks. Each case makes a lean copy of the
// checkout (the head), breaks one behaviour there, and runs the guard in the copy: lean-clone.test.mjs when leanClone
// checks out bench/ or tournaments/, or drops a tag or a branch; setup-skills-switch.test.mjs when setup.sh runs npm
// with CCP_SETUP_SKILLS=0, or skips it without. An unbroken copy passes both (control).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leanClone } from '../../test/regression/lib.mjs';
import { REPO } from './lib.mjs';

const LEAN = 'test/regression/plugin/lean-clone.test.mjs';
const SKILLS = 'test/regression/plugin/setup-skills-switch.test.mjs';
const LIB = 'test/regression/lib.mjs';
const SETUP = 'infra/cloud-environment/setup.sh';
const SWITCH = '[ "${CCP_SETUP_SKILLS:-1}" = 0 ]';
const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'rsl', GIT_AUTHOR_EMAIL: 'rsl@x',
  GIT_COMMITTER_NAME: 'rsl', GIT_COMMITTER_EMAIL: 'rsl@x' };

/** A lean copy of the checkout with node_modules linked in; `edit` changes one file, committed when `commit` is set. */
function copy(t) {
  const dir = mkdtempSync(join(tmpdir(), `rsl-bite-${process.pid}-`));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const root = leanClone(REPO, join(dir, 'copy'));
  symlinkSync(join(REPO, 'node_modules'), join(root, 'node_modules'));
  const git = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: root, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    root, git,
    edit(path, from, to, { commit = false } = {}) {
      const text = readFileSync(join(root, path), 'utf8');
      assert.ok(text.includes(from), `${path} holds ${from}`);
      writeFileSync(join(root, path), text.replace(from, to));
      if (commit) git('commit', '-q', '-am', `break ${path}`);
    },
    run(file) {
      const { NODE_TEST_CONTEXT, ...env } = process.env;
      const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: root, encoding: 'utf8', env, maxBuffer: 1 << 26 });
      return { status: r.status, out: `${r.stdout}${r.stderr}` };
    },
  };
}

test('guards-bite: an unbroken lean copy passes both guards (control)', (t) => {
  const c = copy(t);
  c.git('branch', 'second-branch');
  for (const f of [LEAN, SKILLS]) { const r = c.run(f); assert.equal(r.status, 0, `${f}\n${r.out}`); assert.match(r.out, /# fail 0/); }
});

const LEAN_BREAKS = [
  ['leanClone checks out bench/', "'!/bench/', ", ''],
  ['leanClone checks out tournaments/', ", '!/tournaments/'", ''],
  ['leanClone drops the tags', "'--no-checkout', ...args", "'--no-checkout', '--no-tags', ...args"],
  ['leanClone drops every branch but one', "'--no-checkout', ...args", "'--no-checkout', '--single-branch', ...args"],
];
for (const [name, from, to] of LEAN_BREAKS) {
  test(`guards-bite: lean-clone fails when ${name}`, (t) => {
    const c = copy(t);
    c.git('branch', 'second-branch');
    c.edit(LIB, from, to);
    const r = c.run(LEAN);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /not ok \d+ - a lean clone/);
  });
}

const SKILL_BREAKS = [
  ['setup.sh runs npm with CCP_SETUP_SKILLS=0', SWITCH, '[ "${CCP_SETUP_SKILLS:-1}" = never ]', /not ok \d+ - with CCP_SETUP_SKILLS=0/],
  ['setup.sh skips npm without it', SWITCH, '[ "${CCP_SETUP_SKILLS:-1}" != never ]', /not ok \d+ - without it/],
];
for (const [name, from, to, red] of SKILL_BREAKS) {
  test(`guards-bite: setup-skills-switch fails when ${name}`, (t) => {
    const c = copy(t);
    c.edit(SETUP, from, to, { commit: true });
    const r = c.run(SKILLS);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, red);
  });
}
