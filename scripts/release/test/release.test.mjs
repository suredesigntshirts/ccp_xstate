// The release rules (scripts/release/release.mjs), run against temp git repos.
// Expect line release (plan item self-update-by-version): a push touching the plugin makes a higher tag, others don't.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compare, newestTag, nextVersion, plan, row, tag } from '../release.mjs';
import { validate } from '../../../packages/journal/src/index.js';

const git = (cwd, ...args) => execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

/** A repo with a plugin manifest at `version`, a journal file and a doc, pushed to a bare origin. */
function repo(version = '0.1.0') {
  const dir = mkdtempSync(join(tmpdir(), 'ccp-release-'));
  const origin = join(dir, 'origin.git');
  const cwd = join(dir, 'clone');
  execFileSync('git', ['init', '-q', '--bare', origin]);
  execFileSync('git', ['init', '-q', '-b', 'main', cwd]);
  git(cwd, 'remote', 'add', 'origin', origin);
  write(cwd, 'plugins/harness/.claude-plugin/plugin.json', JSON.stringify({ name: 'ccp-harness', version }));
  write(cwd, 'packages/journal/src/index.js', '1');
  write(cwd, 'docs/a.md', '1');
  commit(cwd, 'start');
  return cwd;
}
function write(cwd, path, text) {
  mkdirSync(dirname(join(cwd, path)), { recursive: true });
  writeFileSync(join(cwd, path), text);
}
function commit(cwd, message) {
  git(cwd, 'add', '-A');
  git(cwd, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', message);
  return git(cwd, 'rev-parse', 'HEAD');
}
/** One merge: change `path`, commit, and run the release as the workflow would. */
function merge(cwd, path, text = String(Math.random())) {
  const before = git(cwd, 'rev-parse', 'HEAD');
  write(cwd, path, text);
  const sha = commit(cwd, `change ${path}`);
  const decision = plan({ cwd, sha, before });
  tag(decision, { cwd, env: {} });
  return decision;
}
const tags = (cwd) => git(cwd, 'tag', '-l', 'harness-v*').split('\n').filter(Boolean).sort(compare);

test('release: the first plugin change is released at the manifest version, with no tag before it', () => {
  const cwd = repo('0.1.0');
  const d = merge(cwd, 'plugins/harness/scripts/a.mjs');
  assert.equal(d.release, true);
  assert.equal(d.tag, 'harness-v0.1.0');
  assert.deepEqual(d.changed, ['plugins/harness/scripts/a.mjs']);
  assert.deepEqual(tags(cwd), ['harness-v0.1.0']);
  assert.equal(git(cwd, 'rev-list', '-n1', 'harness-v0.1.0'), d.sha);
});

test('release: each later plugin or journal change is a higher tag; docs and tests are not released', () => {
  const cwd = repo('0.1.0');
  merge(cwd, 'plugins/harness/scripts/a.mjs');
  assert.equal(merge(cwd, 'docs/a.md').release, false);
  assert.equal(merge(cwd, 'plugins/harness/test/a.test.mjs').release, false);
  assert.equal(merge(cwd, 'packages/journal/test/a.test.js').release, false);
  assert.deepEqual(tags(cwd), ['harness-v0.1.0']);
  assert.equal(merge(cwd, 'plugins/harness/README.md').tag, 'harness-v0.1.1');
  assert.equal(merge(cwd, 'packages/journal/src/index.js').tag, 'harness-v0.1.2');
  assert.deepEqual(tags(cwd), ['harness-v0.1.0', 'harness-v0.1.1', 'harness-v0.1.2']);
});

test('release: a raised manifest version is used; a lower one never lowers the release', () => {
  const cwd = repo('0.1.0');
  merge(cwd, 'plugins/harness/scripts/a.mjs');
  merge(cwd, 'plugins/harness/scripts/a.mjs');
  assert.equal(merge(cwd, 'plugins/harness/.claude-plugin/plugin.json', JSON.stringify({ version: '0.3.0' })).tag, 'harness-v0.3.0');
  assert.equal(merge(cwd, 'plugins/harness/.claude-plugin/plugin.json', JSON.stringify({ version: '0.0.9' })).tag, 'harness-v0.3.1');
});

test('release: a change a failed run missed is released by the next push, and a released sha is not tagged twice', () => {
  const cwd = repo('0.1.0');
  merge(cwd, 'plugins/harness/scripts/a.mjs');
  write(cwd, 'plugins/harness/scripts/b.mjs', 'missed');
  commit(cwd, 'its release run failed');
  const d = merge(cwd, 'docs/a.md');
  assert.equal(d.tag, 'harness-v0.1.1');
  assert.deepEqual(d.changed, ['plugins/harness/scripts/b.mjs']);
  const again = plan({ cwd, sha: d.sha });
  assert.equal(again.release, false);
  assert.match(again.reason, /already released as harness-v0\.1\.1/);
});

test('release: the tag is annotated with a valid ci.result row and pushed to origin', () => {
  const cwd = repo('0.2.0');
  const before = git(cwd, 'rev-parse', 'HEAD');
  write(cwd, 'plugins/harness/scripts/a.mjs', 'x');
  const sha = commit(cwd, 'x');
  const d = plan({ cwd, sha, before });
  const r = tag(d, { cwd, push: true, env: { GITHUB_RUN_ID: '42', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r' } });
  assert.deepEqual(validate(r), []);
  assert.equal(r.kind, 'ci.result');
  assert.deepEqual(r.source, { system: 'github', ref: '42' });
  assert.equal(r.release, '0.2.0');
  assert.equal(r.payload.result, 'released');
  const remote = git(cwd, 'ls-remote', '--tags', 'origin');
  assert.match(remote, /refs\/tags\/harness-v0\.2\.0$/m);
  const message = git(cwd, 'tag', '-l', '--format=%(contents)', 'harness-v0.2.0');
  assert.deepEqual(JSON.parse(message.split('\n').at(-1)).payload.sha, sha);
  assert.equal(git(cwd, 'cat-file', '-t', 'harness-v0.2.0'), 'tag');
});

test('release: a skipped push still gives a valid ci.result row and makes no tag', () => {
  const cwd = repo();
  const d = merge(cwd, 'docs/a.md');
  const r = row(d, {});
  assert.deepEqual(validate(r), []);
  assert.equal(r.payload.result, 'skipped');
  assert.deepEqual(tags(cwd), []);
});

test('release: the next version is always above the newest', () => {
  for (const latest of ['0.0.0', '0.1.9', '1.2.3', '9.9.99']) {
    for (const manifest of ['0.0.1', '0.1.0', '1.2.3', '1.3.0', '10.0.0']) {
      assert.ok(compare(nextVersion(latest, manifest), latest) > 0, `${latest} ${manifest}`);
    }
  }
  assert.equal(nextVersion(null, '0.1.0'), '0.1.0');
  assert.deepEqual(newestTag(['harness-v0.9.0', 'harness-v0.10.0', 'other', 'harness-vx']), { tag: 'harness-v0.10.0', version: '0.10.0' });
});
