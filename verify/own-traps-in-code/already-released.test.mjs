// already-released: release.mjs branch at a merge that already carries a harness-v tag (made by release.yml, so only
// on origin) exits 0 and says it is already released; a merge with nothing released changed still says no release.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO, commit, gitIn, tmp, write } from './lib.mjs';

const SCRIPT = join(REPO, 'scripts', 'release', 'release.mjs');

function world() {
  const dir = tmp('release');
  const origin = join(dir, 'origin.git');
  const clone = join(dir, 'clone');
  execFileSync('git', ['init', '-q', '--bare', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', clone]);
  const git = gitIn(clone);
  git('remote', 'add', 'origin', origin);
  write(clone, 'plugins/harness/.claude-plugin/plugin.json', JSON.stringify({ name: 'ccp-harness', version: '0.1.0' }));
  write(clone, 'docs/a.md', '1');
  commit(clone, 'start');
  write(clone, 'plugins/harness/scripts/a.mjs', '1');
  const plugin = commit(clone, 'plugin change');
  git('push', '-q', 'origin', 'main');
  return { dir, origin, clone, git, plugin };
}
const cli = (cwd, sha, ...args) => spawnSync(process.execPath, [SCRIPT, 'branch', ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', RELEASE_SHA: sha }
});

test('a merge release.yml already tagged on origin: exit 0, says already released under the tag, makes no branch', () => {
  const w = world();
  const other = join(w.dir, 'actions');
  execFileSync('git', ['clone', '-q', w.origin, other]);
  gitIn(other)('-c', 'user.name=a', '-c', 'user.email=a@a', 'tag', '-a', 'harness-v0.1.0', w.plugin, '-m', 'released');
  gitIn(other)('push', '-q', 'origin', 'refs/tags/harness-v0.1.0');
  assert.equal(w.git('tag', '-l'), '', 'the thread clone has not seen the tag');
  const r = cli(w.clone, w.plugin);
  assert.equal(r.status, 0, r.stderr);
  const last = r.stderr.trim().split('\n').at(-1);
  assert.match(last, /^already released: /);
  assert.match(last, /harness-v0\.1\.0/);
  assert.match(last, /nothing is left to do/);
  assert.doesNotMatch(r.stderr, /no release/);
  assert.equal(JSON.parse(r.stdout).payload.result, 'skipped');
  assert.equal(w.git('branch', '--list', 'release/*'), '');
});

test('a merge already released as a release branch says so too', () => {
  const w = world();
  w.git('push', '-q', 'origin', `${w.plugin}:refs/heads/release/harness-v0.1.0`);
  const r = cli(w.clone, w.plugin, '--push');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /already released: .*harness-v0\.1\.0.*nothing is left to do/);
});

test('a merge with nothing released changed still reports no release, and an untagged plugin merge is released', () => {
  const w = world();
  const fresh = cli(w.clone, w.plugin);
  assert.equal(fresh.status, 0, fresh.stderr);
  assert.match(fresh.stderr, /released harness-v0\.1\.0 at /);
  w.git('push', '-q', 'origin', 'refs/heads/release/harness-v0.1.0');
  write(w.clone, 'docs/a.md', '2');
  const docs = commit(w.clone, 'docs only');
  const r = cli(w.clone, docs);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /^no release: nothing under /m);
  assert.doesNotMatch(r.stderr, /already released/);
});
