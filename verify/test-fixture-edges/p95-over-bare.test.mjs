// p95-over-bare: the cheap test reads p95 over a bare node start at the same quantile. A 300 ms start delay on both
// the hook and the bare start (node --import of a module that blocks) leaves it green at the head and red on p95 with
// the build change taken out; a capture that busy-waits 250 ms on one PostToolUse run turns it red on p95 at the head.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, clone, edit, nodeTest, temp } from './lib.mjs';

after(cleanup);
const CHEAP = ['plugins/harness/test/capture.test.mjs'];

function slowStarts(dir) {
  const block = join(temp('block'), 'block.mjs');
  writeFileSync(block, 'const t = Date.now(); while (Date.now() - t < 300) {}\n');
  edit(dir, 'plugins/harness/test/helpers.mjs', 'spawnSync(process.execPath, [script],', `spawnSync(process.execPath, ['--import', ${JSON.stringify(block)}, script],`);
  edit(dir, 'plugins/harness/test/capture.test.mjs', 'execFileSync(process.execPath, [bare],', `execFileSync(process.execPath, ['--import', ${JSON.stringify(block)}, bare],`);
  return dir;
}
const why = (r) => (r.out.match(/(?:median|p95) \d+ ms[^'"\n]*/g) ?? []).join('; ');

test('a 300 ms start delay on both spawns: the cheap test passes at the head', (t) => {
  const r = nodeTest(slowStarts(clone('p95-head')), CHEAP, { pattern: 'cheap' });
  t.diagnostic(`pass ${r.pass} fail ${r.fail} ${why(r)}`);
  assert.equal(r.fail, 0, r.out.slice(-2000));
  assert.equal(r.pass, 1);
});

test('the same delay with the build change taken out: the cheap test fails on p95', (t) => {
  const r = nodeTest(slowStarts(clone('p95-base', { base: true })), CHEAP, { pattern: 'cheap' });
  t.diagnostic(`pass ${r.pass} fail ${r.fail} ${why(r)}`);
  assert.equal(r.fail, 1);
  assert.match(r.out, /p95 \d+ ms/);
  assert.doesNotMatch(r.out, /median \d+ ms/, 'the median bar held');
});

test('capture busy-waiting 250 ms on one PostToolUse run: the cheap test fails on p95 at the head', (t) => {
  const dir = clone('p95-slow-capture');
  const marker = join(temp('marker'), 'waited');
  edit(dir, 'plugins/harness/scripts/capture.mjs', '  const event = input.hook_event_name;\n',
    `  const event = input.hook_event_name;\n  if (event === 'PostToolUse' && !(await import('node:fs')).existsSync(${JSON.stringify(marker)})) { (await import('node:fs')).writeFileSync(${JSON.stringify(marker)}, ''); const t0 = Date.now(); while (Date.now() - t0 < 250) {} }\n`);
  const r = nodeTest(dir, CHEAP, { pattern: 'cheap' });
  t.diagnostic(`pass ${r.pass} fail ${r.fail} ${why(r)}`);
  assert.equal(r.fail, 1);
  assert.match(r.out, /p95 \d+ ms, of which a bare node start is \d+ ms/);
  assert.doesNotMatch(r.out, /median \d+ ms/, 'the median bar held');
});
