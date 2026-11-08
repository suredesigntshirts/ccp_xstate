// Expect tests-bite: test/plan-check.test.mjs goes red when verifier is put back in readyRequired, and green again when
// restored. The mutation happens in a temp folder holding a copy of plan/ and of the test file, never in this checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, copyPlan, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

test('plan-check.test.mjs goes red with verifier back in readyRequired, green when restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'iht-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyPlan(dir);
  mkdirSync(join(dir, 'test'));
  cpSync(join(REPO, 'test/plan-check.test.mjs'), join(dir, 'test/plan-check.test.mjs'));
  const run = () => node(['--test', '--test-reporter=tap', join(dir, 'test/plan-check.test.mjs')], { cwd: dir });

  const file = join(dir, 'plan/item.schema.json');
  const text = readFileSync(file, 'utf8');
  const schema = JSON.parse(text);
  assert.ok(!schema.readyRequired.includes('verifier'), 'the head leaves verifier out of readyRequired');
  const broken = JSON.stringify({ ...schema, readyRequired: [...schema.readyRequired, 'verifier'] }, null, 2) + '\n';

  const green = run();
  assert.equal(green.status, 0, green.out);
  writeFileSync(file, broken);
  const red = run();
  assert.notEqual(red.status, 0, red.out);
  assert.ok(counts(red.out).fail > 0, red.out);
  writeFileSync(file, text);
  const again = run();
  assert.equal(again.status, 0, again.out);
  const failing = [...red.out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing.join(' | ')}`);
});
