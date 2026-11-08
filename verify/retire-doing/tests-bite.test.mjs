// Expect tests-bite: test/plan-check.test.mjs's test that an item at doing is refused goes red when doing is put back
// into item.schema.json's status enum, and green when restored. The mutation happens in a temp copy of plan/ and test/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

test('plan-check.test.mjs goes red with doing back in the schema, green restored', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'rd-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'test/plan-check.test.mjs']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const run = () => node(['--test', '--test-reporter=tap', join(dir, 'test/plan-check.test.mjs')], { cwd: dir });
  const schema = join(dir, 'plan/item.schema.json');
  const text = readFileSync(schema, 'utf8');
  const from = '"ready",\n        "done",';
  assert.ok(text.includes(from), 'the schema enum lists ready then done');
  const green = run();
  assert.equal(green.status, 0, green.out);
  writeFileSync(schema, text.replace(from, '"ready",\n        "doing",\n        "done",'));
  const red = run();
  writeFileSync(schema, text);
  const again = run();
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  assert.ok(failing(red.out).some((n) => /doing/.test(n)), failing(red.out).join(' | '));
});
