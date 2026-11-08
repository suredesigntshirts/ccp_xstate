// Expect fresh-verifier-follows, the part a test can redo: each test a fresh claude -p session wrote in a clean clone
// of the head (saved verbatim in evidence/fresh-verifier-follows.md) is run against plan/README.md at the checkout,
// and against copies whose step 2 says the same thing in other words.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HERE, node, read } from './lib.mjs';

const evidence = readFileSync(join(HERE, 'evidence/fresh-verifier-follows.md'), 'utf8');
const fresh = [...evidence.matchAll(/^## (Session \d): the test it wrote\n[\s\S]*?```js\n([\s\S]*?)\n```/gm)]
  .map((m) => ({ name: m[1], src: m[2] }));

function runAgainst(src, readme) {
  const dir = mkdtempSync(join(tmpdir(), 'rtt-'));
  try {
    mkdirSync(join(dir, 'plan'));
    mkdirSync(join(dir, 'fresh'));
    writeFileSync(join(dir, 'plan/README.md'), readme);
    writeFileSync(join(dir, 'fresh/build-step.test.mjs'), src);
    return node(['--test', '--test-reporter=tap', join(dir, 'fresh/build-step.test.mjs')], { cwd: dir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const readme = read('plan/README.md');
// Matched loosely so the rewordings still apply once round 7's wording of step 2 is on main.
const SENTENCE = /Its first commit sets (the )?status (to )?`done`/;
const versions = {
  'as it is': readme,
  'reworded as round 7 did ("sets the status to `done`" and "sets status `done`" swapped)':
    readme.replace(SENTENCE, (m) => (m.includes('the status to') ? 'Its first commit sets status `done`'
      : 'Its first commit sets the status to `done`')),
  'reworded in other words ("the PR\'s first commit sets the item\'s status to `done`")':
    readme.replace(SENTENCE, "The PR's first commit sets the item's status to `done`"),
};

test('the evidence holds two fresh tests', () => {
  assert.equal(fresh.length, 2, evidence.slice(0, 500));
});

test('each rewording changes plan/README.md', () => {
  assert.equal(new Set(Object.values(versions)).size, 3);
});

for (const { name, src } of fresh) {
  for (const [version, text] of Object.entries(versions)) {
    test(`${name}'s test passes against plan/README.md ${version}`, (t) => {
      const r = runAgainst(src, text);
      t.diagnostic(r.out.split('\n').filter((l) => /^(not ok|# (pass|fail) )/.test(l)).join(', '));
      assert.equal(r.status, 0, r.out.slice(-1500));
    });
  }
}
