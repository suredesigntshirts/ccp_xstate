// reads-fixture: with the probe's evidence folder gone from a copy of the head, finish-ms.test.mjs still passes, its
// transcript test among the passes and still asserting 4944; no file under plugins/, packages/, scripts/ or test/
// names a path under verify/probe-plugin-agents-thread/.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE, FIXTURE, TEST, headCopy } from './lib.mjs';

const NAME = 'the verifier transcript of probe-plugin-agents-thread gives its real 4944';

test('finish-ms.test.mjs passes in a head copy without the probe evidence, the 4944 test among the passes', () => {
  const dir = headCopy();
  assert.ok(existsSync(join(dir, EVIDENCE)), 'the head still carries the evidence folder before it is removed');
  rmSync(join(dir, EVIDENCE), { recursive: true, force: true });
  assert.ok(!existsSync(join(dir, EVIDENCE)));
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', TEST], { cwd: dir, env, encoding: 'utf8', timeout: 300_000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^# fail 0$/m);
  assert.match(r.stdout, new RegExp(`^ok \\d+ - ${NAME}$`, 'm'));
  const src = readFileSync(join(dir, TEST), 'utf8');
  const body = src.slice(src.indexOf(NAME));
  assert.match(body, /assert\.equal\(ms\(path\), 4944\)/);
  assert.ok(body.slice(0, body.indexOf('assert.equal')).includes("'fixtures', 'agent-transcript.jsonl'"), 'the path joins the fixture');
  assert.ok(existsSync(join(dir, FIXTURE)));
});

function* files(root) {
  for (const n of readdirSync(root)) {
    if (n === 'node_modules' || n === '.git') continue;
    const p = join(root, n);
    if (statSync(p).isDirectory()) yield* files(p); else yield p;
  }
}

test('no file under plugins/, packages/, scripts/ or test/ names a path under verify/probe-plugin-agents-thread/', () => {
  const dir = headCopy();
  // A path written with slashes, or joined from quoted segments ('verify', 'probe-plugin-agents-thread').
  const path = /verify[\\/]+probe-plugin-agents-thread|['"`]verify['"`]\s*,\s*['"`]probe-plugin-agents-thread/;
  const hits = [];
  let read = 0;
  for (const top of ['plugins', 'packages', 'scripts', 'test']) {
    for (const f of files(join(dir, top))) { read++; if (path.test(readFileSync(f, 'utf8'))) hits.push(f.slice(dir.length + 1)); }
  }
  assert.ok(read > 50, `read ${read} files`);
  assert.deepEqual(hits, []);
});
