// setup.sh's CCP_SETUP_SKILLS: with it set to 0 the docs skill is copied without its npm ci; without it, npm ci runs
// once, in the copied skill folder. A stub npm first on PATH records each call and leaves a marker node_modules, so
// nothing is downloaded; setup.sh runs from a lean clone of a bare clone, so its fetches stay local.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { leanClone } from '../lib.mjs';

const REPO = join(import.meta.dirname, '..', '..', '..');
const SKILL = 'documentation-downloader';
const d = mkdtempSync(join(tmpdir(), 'setup-skills-'));
process.on('exit', () => rmSync(d, { recursive: true, force: true }));
const origin = join(d, 'origin.git');
execFileSync('git', ['clone', '-q', '--bare', REPO, origin]);
const clone = leanClone(origin, join(d, 'clone'));
const bin = join(d, 'bin');
mkdirSync(bin);
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|CCP)/.test(k)));

function setup(name, extra) {
  const home = join(d, name);
  mkdirSync(home);
  const calls = join(d, `${name}.npm`);
  writeFileSync(join(bin, 'npm'), `#!/bin/bash\nprintf '%s\\t%s\\n' "$PWD" "$*" >> "${calls}"\nmkdir -p node_modules && : > node_modules/.stub\n`);
  chmodSync(join(bin, 'npm'), 0o755);
  const log = join(d, `${name}.log`);
  execFileSync('bash', [join(clone, 'infra', 'cloud-environment', 'setup.sh')], {
    env: { ...env, HOME: home, PATH: `${bin}:${process.env.PATH}`, CCP_SETUP_LOG: log, CCP_SETUP_REF: 'HEAD', ...extra },
    stdio: 'ignore',
  });
  return {
    log: readFileSync(log, 'utf8'),
    calls: existsSync(calls) ? readFileSync(calls, 'utf8').split('\n').filter(Boolean).map((l) => l.split('\t')) : [],
    skill: join(home, '.claude', 'skills', SKILL),
    plugin: join(home, '.claude', 'skills', 'ccp-harness', '.claude-plugin', 'plugin.json'),
  };
}

test('with CCP_SETUP_SKILLS=0 the plugin is installed and the skill copied, with no npm run and no node_modules', () => {
  const r = setup('off', { CCP_SETUP_SKILLS: '0' });
  assert.ok(existsSync(r.plugin), 'the plugin is installed');
  assert.ok(existsSync(join(r.skill, 'SKILL.md')), 'the skill is copied');
  assert.equal(existsSync(join(r.skill, 'node_modules')), false);
  assert.deepEqual(r.calls, []);
  assert.match(r.log, /npm ci skipped/);
});

test('without it, npm ci runs once in the copied skill folder, and that folder is the installed skill', () => {
  const r = setup('on', {});
  assert.ok(existsSync(r.plugin), 'the plugin is installed');
  assert.equal(r.calls.length, 1, JSON.stringify(r.calls));
  const [cwd, args] = r.calls[0];
  assert.match(args, /^ci\b/);
  assert.match(cwd, new RegExp(`/vendor/${SKILL}$`));
  assert.ok(!cwd.startsWith(clone), 'not in the clone itself');
  assert.ok(existsSync(join(r.skill, 'node_modules', '.stub')), 'the skill installed is the folder npm ran in');
});
