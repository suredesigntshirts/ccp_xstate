// Expect one-suite-command: the one-suite command CLAUDE.md gives, run from the checkout on a verifier folder, runs
// that folder's tests and exits 0; node --test on the bare folder exits non-zero. The command is read from CLAUDE.md's
// Commands block, not written here, and the shell's quotes are taken off as a shell would.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, read, section } from './lib.mjs';

const FOLDER = 'verify/item-head-trim';
const block = section(read('CLAUDE.md'), 'Commands').match(/```\n([\s\S]*?)```/)[1];
const line = block.split('\n').find((l) => /^node --test .*verify\/<item>\//.test(l));
const files = readdirSync(join(REPO, FOLDER)).filter((f) => f.endsWith('.test.mjs'));
const count = (out, k) => Number(out.match(new RegExp(`^# ${k} (\\d+)$`, 'm'))?.[1]);

test('CLAUDE.md gives a one-suite command that names the files and warns a bare folder fails', (t) => {
  t.diagnostic(line ?? '(none)');
  assert.ok(line, block);
  assert.match(line, /bare folder fails/);
});

test('the command, on a verifier folder, runs its tests and exits 0', (t) => {
  const pattern = line.split('#')[0].trim().match(/^node --test "([^"]+)"$/)[1].replace('<item>', FOLDER.split('/')[1]);
  const r = node(['--test', '--test-reporter=tap', pattern]);
  t.diagnostic(`node --test "${pattern}": exit ${r.status}, tests ${count(r.out, 'tests')}, pass ${count(r.out, 'pass')}, fail ${count(r.out, 'fail')}; ${files.length} files`);
  assert.equal(r.status, 0, r.out.slice(-2000));
  assert.ok(count(r.out, 'tests') >= files.length);
  assert.equal(count(r.out, 'pass'), count(r.out, 'tests'));
});

test('node --test on the bare folder exits non-zero', (t) => {
  const r = node(['--test', '--test-reporter=tap', `${FOLDER}/`]);
  t.diagnostic(`node --test ${FOLDER}/: exit ${r.status}; ${r.out.match(/Error: [^\n]*/)?.[0]}`);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /Cannot find module/);
});
