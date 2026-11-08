// Verifier's own tests for plan item self-update-by-version, Expect line no-self-edit: nothing in the update path
// (the notice hook and setup.sh, which does the install and the clone fast-forward) writes under the plugin root a
// running Claude Code uses. Method: snapshot every entry under the watched folders (type, mode, size, mtime, ctime,
// inode, content hash, the folder itself included) before and after running the real scripts, and compare; not what
// the scripts say about themselves. A control run (no running Claude) proves the detector sees writes. To see which
// process wrote what, run a command under scripts/debug/trace-writes.mjs.
import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const made = [];
const tmp = (n) => {
  const d = realpathSync(mkdtempSync(join(tmpdir(), `verify-noself-${n}-`)));
  made.push(d);
  return d;
};
after(() => { for (const d of made) rmSync(d, { recursive: true, force: true }); });
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'user.email=v@v', '-c', 'user.name=v', ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// The test's own environment, so commands keep the container's CA and proxy settings, less the CLAUDE* and CCP*
// variables that describe the session running the test (CLAUDE_PID would point setup.sh's guard at it).
const BASE = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(CLAUDE|CCP)/.test(k)));
const envFor = (home, extra = {}) => ({ ...BASE, HOME: home, ...extra });

/**
 * Every entry under each of `roots` (and the root itself), keyed by path: type, mode, size, mtime, ctime and inode
 * in nanoseconds, and the content hash for a file or the target for a link. A write that restores old content
 * still moves ctime, and a copy moved into place has a new inode. `skip(path)` leaves a subtree out.
 */
export function snap(roots, skip = () => false) {
  const out = {};
  const one = (p) => {
    const s = lstatSync(p, { bigint: true });
    const type = s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file';
    const body = type === 'link' ? readlinkSync(p) : type === 'file' ? createHash('sha256').update(readFileSync(p)).digest('hex') : '';
    out[p] = `${type} ${s.mode} ${s.size} ${s.mtimeNs} ${s.ctimeNs} ${s.ino} ${body}`;
    if (type === 'dir') for (const n of readdirSync(p).sort()) if (!skip(join(p, n))) one(join(p, n));
  };
  for (const r of [roots].flat()) if (existsSync(r)) one(r);
  return out;
}
/** The paths whose entry differs between two snapshots, sorted. */
export function changed(before, now) {
  return [...new Set([...Object.keys(before), ...Object.keys(now)])].filter((p) => before[p] !== now[p]).sort();
}

// An origin with release tags, and a clone of it (which holds setup.sh) tracking origin/main.
function world() {
  const t = tmp('world');
  const origin = join(t, 'origin.git'), clone = join(t, 'clone'), home = join(t, 'home');
  execFileSync('git', ['clone', '-q', '--bare', REPO, origin]);
  // A clone of this repo carries whatever releases it has seen (a thread's clone has harness-v0.1.0 since 16:45Z,
  // CI's shallow checkout has none), so drop them: the world's releases are only the ones each test makes.
  // A bare clone of a detached HEAD points HEAD at a branch at that commit if one exists, which may be one of these refs.
  git(origin, 'update-ref', '--no-deref', 'HEAD', 'HEAD');
  for (const ref of git(origin, 'for-each-ref', '--format=%(refname)', 'refs/tags/harness-v*', 'refs/heads/release/').split('\n').filter(Boolean)) {
    git(origin, 'update-ref', '-d', ref);
  }
  git(origin, 'branch', '-f', 'main', 'HEAD');
  git(origin, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(origin, 'tag', 'harness-v0.0.5', 'main');
  execFileSync('git', ['clone', '-q', origin, clone]);
  mkdirSync(home);
  return { t, origin, clone, home, setup: join(clone, 'infra', 'cloud-environment', 'setup.sh'), dest: join(home, '.claude', 'skills', 'ccp-harness') };
}
const runSetup = (w, extra = {}) => envFor(w.home, { CCP_SETUP_LOG: join(w.t, 'setup.log'), ...extra });
const manifestVersion = (dest) => JSON.parse(readFileSync(join(dest, '.claude-plugin', 'plugin.json'), 'utf8')).version;

const plugin = (w) => [w.dest, w.dest + '.old'];
const settingsOnly = (w) => snap(join(w.home, '.claude'), (p) => p === w.dest || p.startsWith(w.dest + '/'));
const notGit = (c) => (p) => p === join(c, '.git');

test('no-self-edit: setup.sh run beside a live Claude Code in the same HOME writes nothing under the plugin root', async () => {
  const w = world();
  // First container build: no Claude running, installs 0.0.5.
  assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w) }).status, 0);
  assert.equal(manifestVersion(w.dest), '0.0.5');
  // A newer release and a newer main appear on origin.
  const other = join(w.t, 'other');
  execFileSync('git', ['clone', '-q', w.origin, other]);
  git(other, 'commit', '-q', '--allow-empty', '-m', 'advance');
  git(other, 'push', '-q', 'origin', 'HEAD:main');
  git(w.origin, 'tag', 'harness-v9.0.0', 'main');

  const before = snap(plugin(w));
  const settings = settingsOnly(w);
  const claude = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { env: envFor(w.home) });
  try {
    assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w, { CLAUDE_PID: String(claude.pid) }) }).status, 0);
    const log = readFileSync(join(w.t, 'setup.log'), 'utf8');
    assert.match(log, /plugin not replaced: Claude Code \(pid \d+\) is running from this HOME/);
    assert.match(log, /clone fast-forwarded/, 'the update path still ran (the clone moved), so the check is not vacuous');
    assert.deepEqual(changed(before, snap(plugin(w))), [], 'nothing under the plugin root or its .old changed');
    assert.equal(manifestVersion(w.dest), '0.0.5');
    assert.ok(!existsSync(w.dest + '.old'));
    // It still wrote elsewhere under HOME (settings), so the detector is looking at a real writer.
    assert.ok(changed(settings, settingsOnly(w)).length > 0, 'setup.sh wrote under ~/.claude outside the plugin');

    // Control: with no running Claude the same script does replace the plugin, and the detector sees it.
    const control = snap(plugin(w));
    assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w) }).status, 0);
    assert.ok(changed(control, snap(plugin(w))).length > 0, 'detector sees the install when nothing is running');
    assert.equal(manifestVersion(w.dest), '9.0.0');
  } finally {
    claude.kill();
  }
});

test('no-self-edit: a Claude running from a different HOME does not block the install (the guard is not a blanket skip)', () => {
  const w = world();
  assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w) }).status, 0);
  git(w.origin, 'tag', 'harness-v1.2.3', 'main');
  const elsewhere = tmp('otherhome');
  const claude = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { env: envFor(elsewhere) });
  try {
    spawnSync('bash', [w.setup], { env: runSetup(w, { CLAUDE_PID: String(claude.pid) }) });
    assert.equal(manifestVersion(w.dest), '1.2.3');
  } finally {
    claude.kill();
  }
});

test('no-self-edit: the notice hook, run from the installed copy while behind, writes nothing under the plugin root', () => {
  const w = world();
  assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w) }).status, 0); // installs 0.0.5
  git(w.origin, 'tag', 'harness-v0.0.9', 'main');
  const dir = tmp('project'), state = tmp('state');
  execFileSync(process.execPath, [join(w.dest, 'scripts', 'install.mjs')], { env: envFor(w.home, { CCP_HARNESS_DIR: dir }) });
  const before = snap(plugin(w));
  const env = envFor(w.home, { CCP_HARNESS_DIR: dir, CCP_HARNESS_STATE: state, CCP_REPO: w.clone, CLAUDE_PLUGIN_ROOT: w.dest });
  const r = spawnSync(process.execPath, [join(w.dest, 'scripts', 'notice-behind.mjs')],
    { env, input: JSON.stringify({ session_id: 'v1', hook_event_name: 'UserPromptSubmit', prompt: 'hi' }), encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /0\.0\.9/, 'the hook did tell the session it is behind, so the whole path ran');
  assert.deepEqual(changed(before, snap(plugin(w))), []);
  assert.ok(readdirSync(state).length > 0, 'its one write is its timestamp, outside the plugin root');
});

/** A throwaway clone of the world's origin with a commit that changes the plugin. */
function pluginChange(w) {
  const c = join(w.t, 'rel');
  execFileSync('git', ['clone', '-q', w.origin, c]);
  writeFileSync(join(c, 'plugins', 'harness', 'NEW.txt'), 'x');
  git(c, 'add', '-A');
  git(c, 'commit', '-q', '-m', 'plugin change');
  return c;
}

test('no-self-edit: release.mjs only writes git objects and refs in the repo it is run in, never the plugin', () => {
  const w = world();
  const c = pluginChange(w);
  const tree = snap(c, notGit(c)), home = snap(join(w.home, '.claude'));
  const r = spawnSync(process.execPath, [join(c, 'scripts', 'release', 'release.mjs'), 'tag'], { cwd: c, env: envFor(w.home, { GITHUB_SHA: git(c, 'rev-parse', 'HEAD') }), encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  assert.match(git(c, 'tag', '-l', 'harness-v*', '--sort=-v:refname'), /harness-v0\.1\.0/);
  assert.deepEqual(changed(tree, snap(c, notGit(c))), [], 'outside .git, nothing in the working tree is written');
  assert.deepEqual(changed(home, snap(join(w.home, '.claude'))), []);
});

// A release can also be a branch release/harness-v<x.y.z>, which the proxy lets through where it drops tag pushes.
test('no-self-edit: release.mjs branch --push writes only git refs, and pushes release/harness-v<x.y.z> to origin', () => {
  const w = world();
  const c = pluginChange(w);
  git(c, 'push', '-q', 'origin', 'HEAD:main');
  const sha = git(c, 'rev-parse', 'HEAD');
  const tree = snap(c, notGit(c)), home = snap(join(w.home, '.claude'));
  const r = spawnSync(process.execPath, [join(c, 'scripts', 'release', 'release.mjs'), 'branch', '--push'], { cwd: c, env: envFor(w.home, { RELEASE_SHA: sha }), encoding: 'utf8', timeout: 30000 });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(git(w.origin, 'rev-parse', 'refs/heads/release/harness-v0.1.0'), sha, 'branch pushed at the sha (manifest 0.1.0 > tag 0.0.5 + 1)');
  assert.deepEqual(changed(tree, snap(c, notGit(c))), [], 'outside .git, nothing is written');
  assert.deepEqual(changed(home, snap(join(w.home, '.claude'))), []);
});

test('no-self-edit: setup.sh beside a live Claude, with the newest release only a branch, leaves the plugin untouched; without Claude it installs that branch', () => {
  const w = world();
  assert.equal(spawnSync('bash', [w.setup], { env: runSetup(w) }).status, 0);
  assert.equal(manifestVersion(w.dest), '0.0.5');
  git(w.origin, 'branch', 'release/harness-v9.1.0', 'main');
  const before = snap(plugin(w));
  const claude = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { env: envFor(w.home) });
  try {
    spawnSync('bash', [w.setup], { env: runSetup(w, { CLAUDE_PID: String(claude.pid) }) });
    assert.match(readFileSync(join(w.t, 'setup.log'), 'utf8'), /plugin not replaced: Claude Code/);
    assert.deepEqual(changed(before, snap(plugin(w))), []);
    assert.equal(manifestVersion(w.dest), '0.0.5');
    const control = snap(plugin(w));
    spawnSync('bash', [w.setup], { env: runSetup(w) });
    assert.ok(changed(control, snap(plugin(w))).length > 0);
    assert.equal(manifestVersion(w.dest), '9.1.0', 'a release branch is picked up as the newest release');
  } finally {
    claude.kill();
  }
});
