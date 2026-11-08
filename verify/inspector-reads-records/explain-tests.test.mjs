// Expect line explain-tests of plan item inspector-reads-records (proof: builder). In a git worktree of the
// checkout's HEAD, the builder's packages/engine/test/explain.test.js passes intact, and goes red when explain.js
// (1) tries a state's ancestors before the state itself, and (2) leaves the needs of a transition's target out of
// its failing check, so it stops at a transition whose need fails.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, tempDir } from './lib.mjs';

const UPWARD = "const upward = (key) => key.split('.').map((_, i, parts) => parts.slice(0, parts.length - i).join('.'));";
const FAILING = 'const failing = failingOf(spec, t.def, target, scope);';
const MUTATIONS = {
  intact: (src) => src,
  'ancestors first': (src) => src.replace(UPWARD, UPWARD.replace(/;$/, '.reverse();')),
  'needs skipped': (src) => src.replace(FAILING, 'const failing = failingOf(spec, t.def, null, scope);')
};

function runIn(name) {
  const dir = join(tempDir('wt'), 'repo');
  execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '--detach', dir, 'HEAD'], { stdio: 'ignore' });
  try {
    symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
    const file = join(dir, 'packages/engine/src/explain.js');
    const src = readFileSync(file, 'utf8');
    const mutated = MUTATIONS[name](src);
    if (name !== 'intact') assert.notEqual(mutated, src, `mutation ${name} applied`);
    writeFileSync(file, mutated);
    const { NODE_TEST_CONTEXT, ...env } = process.env;
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', 'packages/engine/test/explain.test.js'], { cwd: dir, env, encoding: 'utf8', timeout: 600000 });
    const out = r.stdout ?? '';
    return {
      code: r.status,
      pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? NaN),
      fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? NaN),
      red: out.split('\n').filter((l) => /^not ok \d+ - /.test(l)).map((l) => l.replace(/^not ok \d+ - /, ''))
    };
  } finally {
    execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', dir], { stdio: 'ignore' });
  }
}

test('explain-tests: the builder\'s explain tests pass intact and go red under each mutation', () => {
  const results = Object.fromEntries(Object.keys(MUTATIONS).map((m) => [m, runIn(m)]));
  console.log('explain-tests', JSON.stringify(results));
  assert.equal(results.intact.code, 0, 'intact passes');
  assert.equal(results.intact.fail, 0);
  for (const m of ['ancestors first', 'needs skipped']) {
    assert.notEqual(results[m].code, 0, `${m}: red`);
    assert.ok(results[m].fail > 0, `${m}: a test fails`);
  }
});
