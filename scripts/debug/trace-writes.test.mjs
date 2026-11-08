import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, realpathSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writesUnder } from './trace-writes.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'trace-writes.mjs');
const hasStrace = spawnSync('strace', ['-V']).status === 0;

test('writesUnder follows chdir and fork, resolves dirfds, and drops reads and failed calls', () => {
  const trace = [
    '10 chdir("/w") = 0',
    '10 clone(child_stack=NULL, flags=SIGCHLD) = 11',
    '11 openat(AT_FDCWD, "a.txt", O_WRONLY|O_CREAT|O_TRUNC, 0666) = 3</w/a.txt>',
    '11 openat(AT_FDCWD, "r.txt", O_RDONLY) = 3</w/r.txt>',
    '11 unlink("gone") = -1 ENOENT (No such file or directory)',
    '10 mkdirat(5</w/d>, "sub", 0777 <unfinished ...>',
    '10 <... mkdirat resumed>) = 0',
    '12 rename("/elsewhere/x", "/elsewhere/y") = 0',
  ].join('\n');
  const hits = writesUnder(trace, '/w', '/start');
  assert.deepEqual(hits.map((h) => [h.pid, h.call, h.path]), [[11, 'openat', '/w/a.txt'], [10, 'mkdirat', '/w/d/sub']]);
});

test('the script reports writes by absolute and relative path, keeps the command status, and leaves no trace', { skip: !hasStrace && 'strace missing' }, (t) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'tw-test-')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const before = readdirSync(tmpdir()).filter((n) => n.startsWith('trace-writes-'));
  const r = spawnSync(process.execPath, [SCRIPT, dir, '--', 'bash', '-c', `cd ${dir} && echo a > rel && echo b > ${dir}/abs; exit 4`], { encoding: 'utf8' });
  assert.equal(r.status, 4);
  assert.match(r.stdout, new RegExp(`openat ${dir}/rel\\n`));
  assert.match(r.stdout, new RegExp(`openat ${dir}/abs\\n`));
  assert.deepEqual(readdirSync(tmpdir()).filter((n) => n.startsWith('trace-writes-')), before);
  const kept = join(dir, 'kept.trace');
  assert.equal(spawnSync(process.execPath, [SCRIPT, dir, '--keep', kept, '--', 'true']).status, 0);
  assert.ok(existsSync(kept));
});

// /dev/shm is a tmpfs on Linux, so on another file system from the temp dir wherever that is a disk.
const shm = existsSync('/dev/shm') && statSync('/dev/shm').dev !== statSync(tmpdir()).dev;
test('--keep writes the trace to a path on another file system from the temp dir', { skip: (!hasStrace && 'strace missing') || (!shm && 'no second file system') }, (t) => {
  const dir = mkdtempSync('/dev/shm/tw-keep-');
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const before = readdirSync(tmpdir()).filter((n) => n.startsWith('trace-writes-'));
  const kept = join(dir, 'kept.trace');
  const r = spawnSync(process.execPath, [SCRIPT, dir, '--keep', kept, '--', 'true'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(statSync(kept).size > 0);
  assert.deepEqual(readdirSync(tmpdir()).filter((n) => n.startsWith('trace-writes-')), before);
});
