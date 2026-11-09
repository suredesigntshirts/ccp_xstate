// runs-alone: npm test runs the cheap test once, alone, in a concurrency-one run that starts after the run holding
// every other file has ended; the earlier run reports it only as skipped. The script's shape and a run of its two
// commands over capture.test.mjs are checked here (--test-skip-pattern leaves the test out of the first one's report); the three full runs record.mjs recorded at the head are read from
// evidence/runs-alone.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { CAPTURE, CHEAP, HEAD, ROOT, cleanup, clone, commands, recorded, runCommand } from './lib.mjs';

after(cleanup);

test('the test script is a parallel pass that skips "cheap: " tests, then a concurrency-one pass of only those', () => {
  const [parallel, serial, ...rest] = commands();
  assert.deepEqual(rest, []);
  assert.match(parallel, /^node --test --test-skip-pattern="\^cheap: " /);
  assert.doesNotMatch(parallel, /--test-concurrency|--test-name-pattern|--test-only/);
  assert.equal(serial, `node --test --test-concurrency=1 --test-name-pattern="^cheap: " ${CAPTURE}`);
});

test('every test named "cheap: " lives in a file the serial pass runs', () => {
  const files = execFileSync('git', ['-C', ROOT, 'ls-files', '*.test.mjs', '*.test.js'], { encoding: 'utf8' }).trim().split('\n');
  const holding = files.filter((f) => /\btest\(\s*['"`]cheap: /.test(readFileSync(join(ROOT, f), 'utf8')));
  assert.deepEqual(holding, [CAPTURE]);
});

test('the two commands over capture.test.mjs: the first skips the cheap test, the second runs only it', () => {
  const dir = clone('alone');
  const [parallel, serial] = commands();
  const narrowed = parallel.replace(/ "test\/.*$/, ` ${CAPTURE}`);
  const first = runCommand(dir, narrowed);
  // --test-skip-pattern leaves a matching test out of the report; anything but skipped would be a result
  assert.deepEqual(first.tests.filter((t) => t.name === CHEAP && t.status !== 'skip'), []);
  assert.ok(first.tests.filter((t) => t.status !== 'skip').length >= 10, first.out.slice(-2000));
  const second = runCommand(dir, serial);
  assert.equal(second.tests.length, 1, second.out.slice(-2000));
  assert.equal(second.tests[0].name, CHEAP);
  assert.notEqual(second.tests[0].status, 'skip');
});

test('three recorded full runs at the head: the cheap test runs once, alone, after the parallel pass ends', () => {
  const r = recorded('runs-alone');
  assert.equal(r.runs.length, 3);
  for (const run of r.runs) {
    assert.equal(run.sha, HEAD);
    const [p, s] = run.passes;
    assert.ok(s.start >= p.end, `serial pass starts ${s.start} before the parallel pass ends ${p.end}`);
    assert.match(s.command, /--test-concurrency=1/);
    assert.deepEqual(p.cheap.filter((s) => s !== 'skip'), []);
    assert.deepEqual(s.cheap, ['pass']);
    assert.equal(s.tests, 1);
    assert.ok(p.files > 100 && p.tests > 1000);
  }
});
