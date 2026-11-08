// strace-kept: scripts/debug/trace-writes.mjs prints the write-like calls of a command and its children under a
// folder, relative paths included, exits with the command's status, leaves no trace file unless --keep names one,
// and says strace is needed when it is missing. The traced cases need strace, which CI lacks; they run where it is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, pathWithout, temp } from './lib.mjs';

const SCRIPT = join(REPO, 'scripts', 'debug', 'trace-writes.mjs');
const TOOL = 'str' + 'ace';
const hasTool = spawnSync(TOOL, ['-V']).status === 0;

function world(t) {
  const d = temp(t, 'trace');
  const f = join(d, 'watched'), out = join(d, 'outside'), tmp = join(d, 'tmp');
  for (const p of [join(f, 'sub'), out, tmp]) mkdirSync(p, { recursive: true });
  // Absolute, relative after cd, relative from a node grandchild after chdir, and one write outside the folder.
  const cmd = ['bash', '-c', [
    `echo a > ${f}/abs.txt`,
    `echo o > ${out}/not-me.txt`,
    `(cd ${f}/sub && echo b > rel.txt && mkdir made)`,
    `${process.execPath} -e "process.chdir('${f}'); require('fs').writeFileSync('n.txt', 'x')"`,
    'exit 3',
  ].join('; ')];
  return { d, f, out, tmp, cmd };
}
const run = (w, args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: w.d, encoding: 'utf8', env: { ...process.env, TMPDIR: w.tmp, ...env } });

test('strace-kept: writes by the command and its children under the folder are printed, relative ones too', { skip: !hasTool && `${TOOL} missing` }, (t) => {
  const w = world(t);
  const r = run(w, [w.f, '--', ...w.cmd]);
  t.diagnostic(r.stdout.trim().replace(/\n/g, ' | '));
  for (const p of [`${w.f}/abs.txt`, `${w.f}/sub/rel.txt`, `${w.f}/sub/made`, `${w.f}/n.txt`]) {
    assert.match(r.stdout, new RegExp(`^\\d+ \\w+ ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${p} printed`);
  }
  assert.doesNotMatch(r.stdout, /not-me\.txt/, 'a write outside the folder is not printed');
  const pids = new Set(r.stdout.trim().split('\n').map((l) => l.split(' ')[0]));
  assert.ok(pids.size >= 3, 'writes from more than one process (children followed)');
  assert.equal(r.status, 3, 'exits with the command\'s status');
  assert.deepEqual(readdirSync(w.tmp), [], 'no trace file left');
});

test('strace-kept: --keep puts the trace where it says, and nothing else is left', { skip: !hasTool && `${TOOL} missing` }, (t) => {
  const w = world(t);
  const kept = join(w.out, 'kept.trace');
  const r = run(w, [w.f, '--keep', kept, '--', 'bash', '-c', `echo a > ${w.f}/abs.txt`]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(kept));
  assert.match(readFileSync(kept, 'utf8'), /abs\.txt/);
  assert.deepEqual(readdirSync(w.tmp), []);
});

test('strace-kept: with strace off PATH it says strace is needed and runs nothing', (t) => {
  const w = world(t);
  const bin = pathWithout(temp(t, 'bin'), [TOOL]);
  const r = run(w, [w.f, '--', 'bash', '-c', `echo a > ${w.f}/abs.txt`], { PATH: bin });
  assert.equal(r.status, 127);
  assert.match(r.stderr, new RegExp(`needs ${TOOL}`));
  assert.ok(!existsSync(join(w.f, 'abs.txt')), 'the command did not run untraced');
});
