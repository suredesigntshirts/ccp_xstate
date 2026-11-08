// Expect tests-bite: test/plan-check.test.mjs's case for words of hex letters goes red when SHA in plan/check.mjs is
// put back to match hex characters alone, and green when restored. The mutation happens in a temp copy of plan/ and
// test/plan-check.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

test('plan-check.test.mjs goes red with SHA matching hex letters alone, green restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'iwg-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'test/plan-check.test.mjs']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const run = () => node(['--test', '--test-reporter=tap', join(dir, 'test/plan-check.test.mjs')], { cwd: dir });
  const file = join(dir, 'plan/check.mjs');
  const text = readFileSync(file, 'utf8');
  const line = text.split('\n').find((l) => /^const SHA = /.test(l));
  assert.ok(line, 'plan/check.mjs defines SHA on one line');
  const broken = 'const SHA = /(?<!\\w)[0-9a-f]{7,}(?!\\w)/i;';
  assert.notEqual(line, broken);
  const green = run();
  assert.equal(green.status, 0, green.out);
  writeFileSync(file, text.replace(line, broken));
  const red = run();
  writeFileSync(file, text);
  const again = run();
  t.diagnostic(`SHA at head: ${line}`);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  assert.ok(failing(red.out).some((n) => /hex letters/.test(n)), failing(red.out).join(' | '));
});
