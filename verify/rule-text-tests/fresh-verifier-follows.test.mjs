// Expect fresh-verifier-follows, the part a test can redo: the test a fresh claude -p session wrote in a clean clone
// of the head (saved verbatim in evidence/fresh-verifier-follows.md) is run against plan/README.md at the checkout,
// and against a copy whose step 2 says the same thing in other words. The rewording is the one round 7 (build PR
// #259) made to that sentence: "sets the status to `done`" became "sets status `done`".
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HERE, node, read } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-verifier-follows.md'), 'utf8');
const freshTest = evidence.split('## The test it wrote')[1].match(/```js\n([\s\S]*?)\n```/)[1];

function runAgainst(readme) {
  const dir = mkdtempSync(join(tmpdir(), 'rtt-'));
  try {
    mkdirSync(join(dir, 'plan'));
    mkdirSync(join(dir, 'fresh'));
    writeFileSync(join(dir, 'plan/README.md'), readme);
    writeFileSync(join(dir, 'fresh/build-step.test.mjs'), freshTest);
    return node(['--test', '--test-reporter=tap', join(dir, 'fresh/build-step.test.mjs')], { cwd: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const readme = read('plan/README.md');
const reworded = readme.replace('Its first commit sets the status to `done`', 'Its first commit sets status `done`');

test('the rewording changes plan/README.md', () => {
  assert.notEqual(reworded, readme);
});

test('the fresh test passes at the checkout', (t) => {
  const r = runAgainst(readme);
  t.diagnostic(r.out.split('\n').filter((l) => /^# (pass|fail) /.test(l)).join(', '));
  assert.equal(r.status, 0, r.out.slice(-1500));
});

test('the fresh test still passes when step 2 is reworded without changing what it says', (t) => {
  const r = runAgainst(reworded);
  t.diagnostic(r.out.split('\n').filter((l) => /^(not ok|# (pass|fail) )/.test(l)).join(', '));
  assert.equal(r.status, 0, r.out.slice(-1500));
});
