// Expect released-named-once: plugins/harness/README.md's Releases names RELEASED and no longer lists the released
// paths; on a temp repo where a release exists and nothing released changed after it, plan() returns a reason naming
// every path RELEASED includes. The temp repo is made with the container's signing off (docs/traps.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, flat, read, section } from './lib.mjs';

const { RELEASED, plan } = await import(pathToFileURL(join(REPO, 'scripts/release/release.mjs')).href);
const included = RELEASED.filter((p) => !p.startsWith(':'));

test("plugins/harness/README.md's Releases names RELEASED for what makes a release, and lists no released path", (t) => {
  const all = flat(section(read('plugins/harness/README.md'), 'Releases'));
  // What makes a release is said before the thread that merged pushes it; later lines say where the copy bundles
  // packages, which is not a list of what is released.
  const releases = all.slice(0, all.indexOf('The thread that merged'));
  t.diagnostic(releases);
  assert.ok(releases.length > 40, all);
  assert.match(releases, /`RELEASED`/);
  for (const p of included) assert.ok(!releases.includes(`\`${p}`), `Releases still lists ${p}`);
});

test('plan() on a temp repo with a release and no released change after it names every included path', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'avg-release-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'v', GIT_AUTHOR_EMAIL: 'v@example.invalid', GIT_COMMITTER_NAME: 'v', GIT_COMMITTER_EMAIL: 'v@example.invalid' };
  const git = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a],
    { cwd: dir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const put = (p, s) => { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), s); };
  git('init', '-q', '-b', 'main');
  put('plugins/harness/.claude-plugin/plugin.json', JSON.stringify({ version: '0.1.0' }));
  put('packages/journal/src/index.js', '');
  put('packages/engine/src/a.js', '');
  put('packages/engine/messages.md', '');
  git('add', '-A'); git('commit', '-q', '-m', 'first');
  git('branch', 'release/harness-v0.1.0');
  put('docs/other.md', 'not released');
  put('plugins/harness/test/x.test.mjs', 'excluded');
  git('add', '-A'); git('commit', '-q', '-m', 'second');
  const d = plan({ cwd: dir });
  t.diagnostic(d.reason);
  assert.equal(d.release, false);
  assert.deepEqual(d.changed, []);
  for (const p of included) assert.ok(d.reason.includes(p), `reason misses ${p}`);
  assert.match(d.reason, /harness-v0\.1\.0/);
});
