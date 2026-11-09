// skills-switch: setup.sh with CCP_SETUP_SKILLS=0 installs the plugin and copies the docs skill with no node_modules
// and runs no npm; without it, npm ci runs once in the copied skill folder and its node_modules is installed.
// setup.sh runs from a lean clone whose origin is a bare clone of the checkout, so its fetches stay local and its
// clone fast-forward never touches the checkout. A stub npm first on PATH records each call and its folder, and
// leaves a marker node_modules where it ran, so no package is downloaded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, cleanEnv, run, stub, temp } from './lib.mjs';
import { leanClone } from '../../test/regression/lib.mjs';

const SKILL = 'documentation-downloader';

function world() {
  const d = temp('skills');
  const origin = join(d, 'origin.git');
  run(REPO, ['clone', '-q', '--bare', REPO, origin]);
  const clone = leanClone(origin, join(d, 'clone'));
  const calls = join(d, 'npm-calls');
  stub(join(d, 'bin'), 'npm', `printf '%s\\t%s\\n' "$PWD" "$*" >> "${calls}"\nmkdir -p node_modules && : > node_modules/.from-stub-npm\n`);
  return { d, clone, calls, bin: join(d, 'bin') };
}

function setup(w, name, extra) {
  const home = join(w.d, name);
  mkdirSync(home);
  const log = join(w.d, `${name}.log`);
  execFileSync('bash', [join(w.clone, 'infra', 'cloud-environment', 'setup.sh')], {
    env: cleanEnv({ HOME: home, PATH: `${w.bin}:${process.env.PATH}`, CCP_SETUP_LOG: log, CCP_SETUP_REF: 'HEAD', ...extra }),
    stdio: 'ignore',
  });
  const calls = existsSync(w.calls) ? readFileSync(w.calls, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : [];
  return { home, log: readFileSync(log, 'utf8'), calls, skill: join(home, '.claude', 'skills', SKILL), plugin: join(home, '.claude', 'skills', 'ccp-harness') };
}

test('skills-switch: with CCP_SETUP_SKILLS=0 the plugin is installed, the skill copied without node_modules, and npm never runs', (t) => {
  const w = world();
  const r = setup(w, 'home-off', { CCP_SETUP_SKILLS: '0' });
  assert.ok(existsSync(join(r.plugin, '.claude-plugin', 'plugin.json')), 'the plugin is installed');
  assert.ok(existsSync(join(r.skill, 'SKILL.md')), 'the skill is copied');
  assert.ok(existsSync(join(r.skill, 'package-lock.json')), 'the skill copy carries its lockfile');
  assert.equal(existsSync(join(r.skill, 'node_modules')), false, 'no node_modules in the skill');
  assert.deepEqual(r.calls, [], 'npm was not called');
  assert.match(r.log, /npm ci skipped/, 'the log says npm was skipped');
  t.diagnostic(r.log.split('\n').filter((l) => /skill|plugin /.test(l)).join(' | '));
});

test('skills-switch: without it, npm ci runs once, in the copied skill folder, and that node_modules is installed', (t) => {
  const w = world();
  const r = setup(w, 'home-on', {});
  assert.ok(existsSync(join(r.plugin, '.claude-plugin', 'plugin.json')), 'the plugin is installed');
  assert.equal(r.calls.length, 1, `one npm call: ${JSON.stringify(r.calls)}`);
  const [cwd, args] = r.calls[0];
  assert.match(args, /^ci\b/, 'the call is npm ci');
  assert.match(cwd, new RegExp(`/vendor/${SKILL}$`), 'it runs in the skill folder copied out of the clone');
  assert.ok(!cwd.startsWith(w.clone), 'not in the clone itself');
  assert.ok(existsSync(join(r.skill, 'node_modules', '.from-stub-npm')), 'the folder npm ran in is the installed skill, node_modules included');
  assert.doesNotMatch(r.log, /npm ci skipped/);
  t.diagnostic(`npm ${args} in ${cwd}`);
});
