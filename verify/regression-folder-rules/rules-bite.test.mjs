// The guard passes on a copy of the head and fails, naming the file, for each of the six breaks the item names:
// a regression test file with no header, a header naming an Expect id no item holds, a regression file reading under
// verify/, a second helper under test/regression/, a guard cloning the repo with plain git clone, and a guard running
// setup.sh without CCP_SETUP_SKILLS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { copyHead, runGuard } from './lib.mjs';

const VICTIM = 'test/regression/plugin/lean-clone.test.mjs';
const edit = (dir, rel, fn) => writeFileSync(join(dir, rel), fn(readFileSync(join(dir, rel), 'utf8')));

test('passes on an unbroken copy of the head', (t) => {
  const r = runGuard(copyHead(t));
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /^# pass 5$/m);
});

const BREAKS = [
  { name: 'a regression test file with no header', file: VICTIM, test: 'opens with an Expect: header',
    make: (d) => edit(d, VICTIM, (s) => s.split('\n').slice(1).join('\n')) },
  { name: 'a header naming an Expect id no item holds', file: VICTIM, test: 'opens with an Expect: header',
    make: (d) => edit(d, VICTIM, (s) => s.replace('// Expect: fast-test-clones-and-setup/lean-clone', '// Expect: fast-test-clones-and-setup/no-such-line')) },
  { name: 'a regression file that reads under verify/', file: VICTIM, test: 'reads under verify/',
    make: (d) => edit(d, VICTIM, (s) => s + "\nconst stale = readFileSync(join(REPO, 'verify', 'fast-test-clones-and-setup', 'verdict.json'), 'utf8');\n") },
  { name: 'a second helper file under test/regression/', file: 'test/regression/plugin/helpers.mjs', test: 'lib.mjs is the one code file',
    make: (d) => writeFileSync(join(d, 'test/regression/plugin/helpers.mjs'), "export const two = () => 2;\n") },
  { name: 'a guard cloning the repo with plain git clone', file: 'test/plain-clone.test.mjs', test: 'clones the repo only through leanClone',
    make: (d) => writeFileSync(join(d, 'test/plain-clone.test.mjs'), "import { execFileSync } from 'node:child_process';\nimport { join } from 'node:path';\nconst REPO = join(import.meta.dirname, '..');\nexecFileSync('git', ['clone', '-q', REPO, '/tmp/x']);\n") },
  { name: 'a guard running setup.sh without CCP_SETUP_SKILLS', file: 'test/setup-full.test.mjs', test: 'runs setup.sh sets CCP_SETUP_SKILLS',
    make: (d) => writeFileSync(join(d, 'test/setup-full.test.mjs'), "import { execFileSync } from 'node:child_process';\nimport { join } from 'node:path';\nconst REPO = join(import.meta.dirname, '..');\nexecFileSync('bash', [join(REPO, 'infra', 'cloud-environment', 'setup.sh')], { env: { ...process.env, HOME: '/tmp/h' } });\n") },
];

for (const b of BREAKS) {
  test(`fails, naming the file, on ${b.name}`, (t) => {
    const dir = copyHead(t);
    b.make(dir);
    const r = runGuard(dir);
    assert.notEqual(r.status, 0, r.out);
    assert.match(r.out, /^# fail 1$/m, `exactly one rule fails: ${r.out}`);
    const failing = r.out.match(/^not ok \d+ - (.*)$/m)?.[1] ?? '';
    assert.ok(failing.includes(b.test), `the failing rule is the one for this break: ${failing}`);
    assert.ok(r.out.includes(b.file), `the failure names ${b.file}: ${r.out.slice(-2000)}`);
  });
}
