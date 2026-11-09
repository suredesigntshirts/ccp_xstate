// one-nested-helper: a child node --test run with childEnv's environment runs and reports its own tests, one with the
// parent runner's does not; and the regression-rules guard goes red, naming the file, when a guard drops the test
// context variable itself.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { childEnv } from '../../test/regression/lib.mjs';
import { REPO, copyTracked, tmp, write } from './lib.mjs';

const KEY = ['NODE', 'TEST', 'CONTEXT'].join('_');

test('a nested node --test runs its own tests with childEnv, and reports none with the parent environment', () => {
  // An outer node --test run whose test starts the inner run, so the parent runner's environment is real however
  // this file itself is run (under node --test, or as the entry point the verdict gate uses).
  const dir = tmp('nested');
  const lib = join(REPO, 'test', 'regression', 'lib.mjs');
  write(dir, 'inner/toy.test.mjs', "import { test } from 'node:test';\ntest('toy one', () => {});\ntest('toy two', () => {});\n");
  write(dir, 'outer.test.mjs', `import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { childEnv } from ${JSON.stringify(lib)};
const run = (env) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'inner/toy.test.mjs'], { cwd: ${JSON.stringify(dir)}, env, encoding: 'utf8' });
test('outer', () => {
  writeFileSync('parent-has-key', String(Boolean(process.env.${KEY})));
  writeFileSync('helped.out', run(childEnv()).stdout);
  writeFileSync('inherited.out', run({ ...process.env }).stdout);
});
`);
  const outer = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'outer.test.mjs'], { cwd: dir, env: childEnv(), encoding: 'utf8' });
  assert.equal(outer.status, 0, outer.stdout + outer.stderr);
  const read = (f) => readFileSync(join(dir, f), 'utf8');
  assert.equal(read('parent-has-key'), 'true', 'the outer runner sets the variable for its test file');
  assert.match(read('helped.out'), /^ok 1 - toy one$/m);
  assert.match(read('helped.out'), /^# pass 2$/m);
  assert.doesNotMatch(read('inherited.out'), /^# pass 2$/m, 'with the parent environment the child does not report its own run');
  assert.doesNotMatch(read('inherited.out'), /^ok 1 - toy one$/m);
  assert.equal(childEnv({ from: { [KEY]: 'child', A: '1' } })[KEY], undefined);
});

const rules = (dir) => spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'test/regression-rules.test.mjs'], { cwd: dir, env: childEnv(), encoding: 'utf8' });

test('the regression-rules guard passes as shipped and refuses a guard that drops the variable inline, naming it', () => {
  const dir = copyTracked('rules');
  const clean = rules(dir);
  assert.equal(clean.status, 0, clean.stdout.slice(-3000));
  const target = 'test/regression/plan/layout-map.test.mjs';
  const shapes = [
    `delete process.env.${KEY};`,
    `const e = { ...process.env, ${KEY}: undefined };`,
    `const e = { ...process.env }; delete e['${KEY}'];`
  ];
  const original = readFileSync(join(dir, target), 'utf8');
  for (const shape of shapes) {
    writeFileSync(join(dir, target), `${original}\n${shape}\n`);
    const broken = rules(dir);
    assert.notEqual(broken.status, 0, shape);
    assert.match(broken.stdout, /not ok .*childEnv/, shape);
    assert.ok(broken.stdout.includes(target), `the failure names ${target} for: ${shape}`);
  }
  writeFileSync(join(dir, target), original);
  for (const other of ['scripts/gates/test/new-verdict.test.mjs', 'packages/engine/test/explain.test.js', 'plugins/harness/test/helpers.mjs']) {
    const before = readFileSync(join(dir, other), 'utf8');
    writeFileSync(join(dir, other), `${before}\ndelete process.env.${KEY};\n`);
    const r = rules(dir);
    writeFileSync(join(dir, other), before);
    if (other.endsWith('helpers.mjs')) continue; // a helper, not a test file: recorded as an observation
    assert.notEqual(r.status, 0, other);
    assert.ok(r.stdout.includes(other), `names ${other}`);
  }
});
