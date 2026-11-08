// temp-removed: after node --test runs no-self-edit.test.mjs or test/setup.test.mjs, passing or failing, the temp
// folder holds no entry it did not hold before. Each run gets a fresh, empty TMPDIR (os.tmpdir() reads it), so the
// other files running beside this one cannot add entries to what is counted. The fresh folder starts with the one
// entry every machine that has run npm already holds: npm's shared node-compile-cache, which setup.sh's npm ci makes
// in os.tmpdir() when it is missing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_SELF_EDIT, REPO, SETUP_TEST, cloneHead, commitAll, nodeTest, temp } from './lib.mjs';

function run(t, cwd, file, args = []) {
  const tmp = join(temp(t, 'tmpdir'), 'tmp');
  mkdirSync(join(tmp, 'node-compile-cache'), { recursive: true });
  const before = readdirSync(tmp);
  const r = nodeTest(cwd, file, { env: { ...process.env, TMPDIR: tmp }, args });
  const left = readdirSync(tmp).filter((n) => !before.includes(n));
  t.diagnostic(`${file}: pass ${r.pass} fail ${r.fail}; left in TMPDIR: ${JSON.stringify(left)}`);
  return { r, left };
}

/** A clone of the head with one assertion in `file` changed to fail. */
function broken(t, file, from, to) {
  const c = cloneHead(temp(t, 'broken'));
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  const p = join(c, file), src = readFileSync(p, 'utf8');
  assert.ok(src.includes(from), `${from} in ${file}`);
  writeFileSync(p, src.replace(from, to));
  commitAll(c, 'make one assertion fail');
  return c;
}

test('temp-removed: no-self-edit.test.mjs, passing, leaves nothing in the temp folder', (t) => {
  const { r, left } = run(t, REPO, NO_SELF_EDIT);
  assert.deepEqual({ pass: r.pass, fail: r.fail }, { pass: 6, fail: 0 }, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: no-self-edit.test.mjs, with a test made to fail midway, leaves nothing in the temp folder', (t) => {
  const c = broken(t, NO_SELF_EDIT, "assert.equal(manifestVersion(w.dest), '1.2.3');", "assert.equal(manifestVersion(w.dest), '1.2.4');");
  const { r, left } = run(t, c, NO_SELF_EDIT, ['--test-name-pattern=different HOME|notice hook']);
  assert.deepEqual({ pass: r.pass, fail: r.fail }, { pass: 1, fail: 1 }, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: test/setup.test.mjs, passing, leaves nothing in the temp folder', (t) => {
  const { r, left } = run(t, REPO, SETUP_TEST);
  assert.equal(r.fail, 0, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: test/setup.test.mjs, with a test made to fail, leaves nothing in the temp folder', (t) => {
  const c = broken(t, SETUP_TEST, "assert.equal(release.tag, 'harness-v0.1.10');", "assert.equal(release.tag, 'harness-v9.9.9');");
  const { r, left } = run(t, c, SETUP_TEST);
  assert.equal(r.fail, 1, r.out.slice(-2000));
  assert.deepEqual(left, []);
});
