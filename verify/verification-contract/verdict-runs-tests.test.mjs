// Expect verdict-runs-tests: in a temp git repo holding the head's gates and plan with a PR-shaped branch, the verdict
// gate runs the tests a verdict names for verifier and builder lines and refuses a failing, crashing or missing one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRepo, itemText } from './lib.mjs';

const ID = 'vfy-toy';
const BUILDER = 'https://claude.ai/code/session_vc_builder';
const VERIFIER = 'https://claude.ai/code/session_vc_verifier';
const expect = [
  { id: 'v-line', check: 'The toy does its thing', how: 'verifier tests', proof: 'verifier' },
  { id: 'b-line', check: 'The builder tests bite', how: 'break and run', proof: 'builder' },
  { id: 'w-line', check: 'GitHub shows it', how: 'a PR', proof: 'world' },
];
const TESTS = {
  [`verify/${ID}/pass.test.mjs`]: "import test from 'node:test';\ntest('toy holds', () => {});\ntest('bite holds', () => {});\n",
  [`verify/${ID}/fail.test.mjs`]: "import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('toy holds', () => { assert.equal(1, 2); });\n",
  [`verify/${ID}/crash.test.mjs`]: "import test from 'node:test';\ntest('toy holds', () => {});\nprocess.exit(3);\n",
};

/** A repo whose PR branch has one builder commit and one verifier commit with the given verdict results. */
function pr(t, results, extra = {}) {
  const repo = gateRepo(t, `build/${ID}`, { [`plan/items/${ID}.md`]: itemText(ID, { expect }) });
  const built = repo.commit({ 'src/toy.txt': 'built\n' }, BUILDER, 'build');
  const verdict = { item: ID, verified_sha: built, verifier: { session: VERIFIER, model: 'm' }, results, ...extra };
  repo.commit({ ...TESTS, [`verify/${ID}/verdict.json`]: JSON.stringify(verdict, null, 2) }, VERIFIER, 'verdict');
  return { run: () => repo.gate('verdict', { body: `Item: ${ID}` }) };
}

const res = (id, more = {}) => ({ id, status: 'MET', command: 'cmd', excerpt: 'seen', ...more });
const good = (vTest = `verify/${ID}/pass.test.mjs`, more = {}) => [
  res('v-line', vTest === null ? {} : { test: vTest, ...more }),
  res('b-line', { test: `verify/${ID}/pass.test.mjs`, test_name: 'bite holds', mutation: 'broke it', red_test: 'went red' }),
  res('w-line'),
];

for (const obs of [undefined, ['a naming concern']]) {
  const tag = obs ? 'with observations' : 'without observations';

  test(`passes a verdict whose named tests pass, the world line naming none (${tag})`, (t) => {
    const r = pr(t, good(), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 0, r.out);
    assert.match(r.out, /verdict gate passed/);
  });

  test(`refuses a result whose named test fails by assertion, naming the Expect id and the test (${tag})`, (t) => {
    const r = pr(t, good(`verify/${ID}/fail.test.mjs`), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line[^\n]*fail\.test\.mjs/);
  });

  test(`refuses a result whose named test exits non-zero without an assertion (${tag})`, (t) => {
    const r = pr(t, good(`verify/${ID}/crash.test.mjs`), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line[^\n]*crash\.test\.mjs/);
  });

  test(`refuses a verifier result that names no test (${tag})`, (t) => {
    const r = pr(t, good(null), obs ? { observations: obs } : {}).run();
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /v-line/);
  });
}

test('refuses a builder result that names no test', (t) => {
  const results = good();
  delete results[1].test; delete results[1].test_name;
  const r = pr(t, results).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /b-line/);
});

test('refuses a named test file that does not exist at the head', (t) => {
  const r = pr(t, good(`verify/${ID}/nope.test.mjs`)).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line[^\n]*nope\.test\.mjs/);
});

test('refuses a test path outside verify/<item>/', (t) => {
  const r = pr(t, good('scripts/gates/lib.mjs')).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line/);
});

test('refuses a test_name that matches no test in the file', (t) => {
  const r = pr(t, good(`verify/${ID}/pass.test.mjs`, { test_name: 'no such test' })).run();
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /v-line/);
});
