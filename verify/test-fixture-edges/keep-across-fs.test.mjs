// keep-across-fs: trace-writes.mjs --keep <path> leaves the trace at <path> and no trace-writes-* folder in the temp
// dir, whether <path> is on the temp dir's file system or another one. Runs with the real strace where there is one,
// and always with a stand-in strace (writes an execve line to its -o file, then runs the command), so the --keep
// path is exercised where strace is absent too.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, ROOT, cleanup, clone, temp } from './lib.mjs';

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
  const env = { ...process.env, TMPDIR: tmp, ...(stub ? { PATH: `${stubDir}:${process.env.PATH}` } : {}) };
  delete env.NODE_TEST_CONTEXT;
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

test('with the build change taken out, --keep to another file system fails with EXDEV', (t) => {
  const base = clone('keep-base', { base: true });
  const other = otherFs(temp('probe'));
  assert.ok(other);
  try {
    const keep = join(other, 'kept.trace');
    const r = run(base, keep, { stub: !realStrace });
    t.diagnostic(`exit ${r.status}; ${r.stderr.split('\n').find((l) => /EXDEV/.test(l)) ?? r.stderr.slice(0, 300)}`);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /EXDEV/);
  } finally {
    rmSync(other, { recursive: true, force: true });
  }
});
