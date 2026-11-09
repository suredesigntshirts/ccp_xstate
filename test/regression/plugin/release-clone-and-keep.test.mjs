// Expect: test-fixture-edges/detached-release-clone, test-fixture-edges/keep-across-fs
// copy-not-link and no-self-edit pass in a clone whose HEAD is detached at a commit only a local release branch points
// at; trace-writes.mjs --keep leaves the trace where it says, on the temp dir's file system or another, with the real
// strace where there is one and always with a stand-in.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { leanClone, childEnv } from '../lib.mjs';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..', '..');

const ID = ['-c', 'user.name=verifier', '-c', 'user.email=verifier@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false'];
const GENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

const git = (dir, ...args) => execFileSync('git', [...ID, '-C', dir, ...args], { encoding: 'utf8', env: GENV, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

const made = [];
function temp(name) {
  const d = mkdtempSync(join(tmpdir(), `verify-tfe-${name}-`));
  made.push(d);
  return d;
}
function cleanup() {
  for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true });
}

/** A clone of this checkout's HEAD. */
function clone(name) {
  const dir = join(temp(name), 'repo');
  leanClone(ROOT, dir, { args: ['--no-hardlinks'], env: GENV });
  if (existsSync(join(ROOT, 'node_modules'))) symlinkSync(join(ROOT, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}

/** Replaces exactly one occurrence of `from` in `file` under `dir`. */
function edit(dir, file, from, to) {
  const p = join(dir, file);
  const text = readFileSync(p, 'utf8');
  const n = text.split(from).length - 1;
  if (n !== 1) throw new Error(`${file}: expected one '${from}', found ${n}`);
  writeFileSync(p, text.replace(from, to));
}

/** node --test with the TAP reporter in `dir`; the counts and the failing test names. */
function nodeTest(dir, files, { pattern, env = process.env, timeout = 600_000 } = {}) {
  env = childEnv({ from: env });
  const args = ['--test', '--test-reporter=tap', ...(pattern ? [`--test-name-pattern=${pattern}`] : []), ...files];
  const r = spawnSync(process.execPath, args, { cwd: dir, encoding: 'utf8', env, timeout, maxBuffer: 64 << 20 });
  const out = `${r.stdout}\n${r.stderr}`;
  const count = (k) => Number(out.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? NaN);
  const failed = [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { status: r.status, pass: count('pass'), fail: count('fail'), skipped: count('skipped'), failed, out };
}

{
after(cleanup);
const FILES = ['test/setup.test.mjs', 'test/regression/plugin/no-self-edit.test.mjs'];

function detachedWithRelease(name, opts) {
  const dir = clone(name, opts);
  git(dir, 'checkout', '-q', '--detach');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'a commit only the release branch points at');
  git(dir, 'branch', 'release/harness-v9.9.9');
  const at = git(dir, 'rev-parse', 'HEAD');
  const pointing = git(dir, 'for-each-ref', '--points-at', at, '--format=%(refname)').split('\n').filter(Boolean);
  assert.deepEqual(pointing, ['refs/heads/release/harness-v9.9.9']);
  assert.equal(headName(dir), 'HEAD', 'HEAD is detached');
  return dir;
}
const headName = (dir) => git(dir, 'rev-parse', '--abbrev-ref', 'HEAD');

test('at the head every copy-not-link and no-self-edit test passes, none skipped', (t) => {
  const r = nodeTest(detachedWithRelease('head'), FILES);
  t.diagnostic(`pass ${r.pass} fail ${r.fail} skipped ${r.skipped}`);
  assert.equal(r.fail, 0, r.failed.join('\n') + r.out.slice(-3000));
  assert.equal(r.skipped, 0);
  assert.ok(r.pass >= 12, `pass ${r.pass}`);
  assert.equal(r.status, 0);
});
}

{
after(cleanup);
const SCRIPT = 'scripts/debug/trace-writes.mjs';
// The tracer is whatever command the script checks for with -V; the stand-in takes that name. Whether the real one
// is here is read from the script itself: it exits 127 when the tracer is missing.
const TRACER = readFileSync(join(ROOT, SCRIPT), 'utf8').match(/spawnSync\('(\w+)', \['-V'\]\)/)[1];
const realStrace = spawnSync(process.execPath, [join(ROOT, SCRIPT), ROOT, '--', 'true'], { stdio: 'ignore' }).status !== 127;

// A writable folder whose file system differs from the temp dir's.
function otherFs(tmp) {
  const dev = statSync(tmp).dev;
  for (const c of ['/dev/shm', '/run/shm', '/run/user/' + process.getuid?.(), '/run', '/var/tmp', ROOT]) {
    try {
      if (statSync(c).dev === dev) continue;
      const d = mkdtempSync(join(c, 'verify-tfe-other-'));
      return d;
    } catch {}
  }
  return null;
}

const stubDir = temp('stub');
writeFileSync(join(stubDir, TRACER), `#!/usr/bin/env bash
if [ "$1" = -V ]; then echo 'stand-in tracer'; exit 0; fi
out=; while [ $# -gt 0 ]; do case "$1" in -o) out=$2; shift 2;; -e|-s) shift 2;; -*) shift;; *) break;; esac; done
printf '%s execve("%s", ["%s"], 0x0 /* 0 vars */) = 0\\n' $$ "$(type -P "$1")" "$1" > "$out"
exec "$@"
`);
chmodSync(join(stubDir, TRACER), 0o755);

function run(root, keep, { stub }) {
  const tmp = mkdtempSync(join(temp('tmpdir'), 't-'));
  const env = childEnv({ add: { TMPDIR: tmp, ...(stub ? { PATH: `${stubDir}:${process.env.PATH}` } : {}) } });
  const watched = temp('watched');
  const r = spawnSync(process.execPath, [join(root, SCRIPT), watched, '--keep', keep, '--', 'true'], { env, encoding: 'utf8' });
  return { ...r, left: readdirSync(tmp).filter((n) => n.startsWith('trace-writes-')), tmp };
}

function check(t, root, { stub }) {
  const tmpBase = temp('probe');
  const other = otherFs(tmpBase);
  assert.ok(other, 'found a folder on another file system than the temp dir');
  try {
    const cases = { same: join(tmpBase, 'kept.trace'), other: join(other, 'kept.trace') };
    for (const [name, keep] of Object.entries(cases)) {
      const r = run(root, keep, { stub });
      if (name === 'same') assert.equal(statSync(keep).dev, statSync(r.tmp).dev);
      else assert.notEqual(statSync(keep, { throwIfNoEntry: false })?.dev ?? statSync(other).dev, statSync(r.tmp).dev);
      assert.equal(r.status, 0, `${name}: ${r.stderr}`);
      assert.ok(existsSync(keep) && statSync(keep).size > 0, `${name}: trace kept`);
      assert.match(readFileSync(keep, 'utf8'), /execve\("[^"]*\/true"/, `${name}: names the command's execve`);
      assert.deepEqual(r.left, [], `${name}: no trace-writes-* folder left`);
      t.diagnostic(`${stub ? 'stand-in' : 'real'} strace, ${name} fs (${keep}): exit ${r.status}, ${statSync(keep).size} bytes, left [${r.left}]`);
    }
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
}

test('real strace: --keep works on the same and on another file system', { skip: !realStrace && 'no strace here' }, (t) => check(t, ROOT, { stub: false }));
test('stand-in strace: --keep works on the same and on another file system', (t) => check(t, ROOT, { stub: true }));
}
