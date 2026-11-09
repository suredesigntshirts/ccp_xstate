// guards-pass: every guard under scripts/gates/test and test/regression/gates passes at this checkout, and there are
// as many of them as at the base (175 tests), so none was dropped to get there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { REPO } from './lib.mjs';

test('the gate guards all pass, 175 or more of them', () => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'scripts/gates/test/*.test.mjs', 'test/regression/gates/*.test.mjs'],
    { cwd: REPO, encoding: 'utf8', env, maxBuffer: 64 << 20 });
  const count = (k) => Number(r.stdout.match(new RegExp(`^# ${k} (\\d+)`, 'm'))?.[1] ?? -1);
  assert.equal(r.status, 0, r.stdout.split('\n').filter((l) => /^not ok/.test(l)).join('\n') || r.stderr);
  assert.equal(count('fail'), 0);
  assert.equal(count('skipped'), 0);
  assert.ok(count('tests') >= 175, `tests ${count('tests')}`);
  assert.equal(count('pass'), count('tests'));
});
