// Expect tests-bite: the builder's tests go red when the code they guard is broken, and green when it is restored.
// Each mutation is made in a temp copy of plan/, scripts/ and test/, never in the checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

function copy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vc-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'test/plan-check.test.mjs', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  return dir;
}
function mutate(dir, file, from, to) {
  const p = join(dir, file);
  const text = readFileSync(p, 'utf8');
  assert.ok(from.test(text), `${file} has the code to break`);
  writeFileSync(p, text.replace(from, to));
  return () => writeFileSync(p, text);
}
const run = (dir, file) => node(['--test', '--test-reporter=tap', join(dir, file)], { cwd: dir });
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'test/plan-check.test.mjs goes red when the deny-list in check.mjs is emptied',
    test: 'test/plan-check.test.mjs', code: 'plan/check.mjs', from: /const PINS = \[[^\]]*\]/, to: 'const PINS = []' },
  { name: 'scripts/gates/test/lib.test.mjs goes red when checkVerdict stops requiring test',
    test: 'scripts/gates/test/lib.test.mjs', code: 'scripts/gates/lib.mjs', from: /if \(TESTED\.includes\(e\.proof\)\) \{/, to: 'if (false) {' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = copy(t);
    const green = run(dir, b.test);
    assert.equal(green.status, 0, green.out);
    const restore = mutate(dir, b.code, b.from, b.to);
    const red = run(dir, b.test);
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    restore();
    const again = run(dir, b.test);
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}
