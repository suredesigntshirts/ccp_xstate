import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkFreeze, checkSessions, checkVerdict, contract, findStubs, namedItem, sessionOf, testRunFault, verdictTests } from '../lib.mjs';

const item = (head, brief = 'Run it.') => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n\nWhy.\n\n## Verifier brief\n\n${brief}\n`;
const head = {
  id: 'x', status: 'ready',
  expect: [{ id: 'a', proof: 'world' }, { id: 'b', proof: 'builder' }],
};
const met = (id, extra = {}) => ({ id, status: 'MET', command: 'npm test', excerpt: 'pass 3', ...extra });
const full = { item: 'x', results: [met('a'), met('b', { test: 'verify/x/b.test.mjs', mutation: 'return 0', red_test: 'adds' })] };

test('a complete verdict passes', () => {
  assert.deepEqual(checkVerdict({ item: 'x', head, verdict: full }), []);
});

test('a missing verdict, a missing id, a NOT MET line and a bare builder line each fail', () => {
  assert.match(checkVerdict({ item: 'x', head, verdict: null })[0], /no verify\/x\/verdict.json/);
  assert.match(checkVerdict({ item: 'x', head, verdict: { item: 'x', results: [full.results[1]] } })[0], /no result for Expect a/);
  assert.match(checkVerdict({ item: 'x', head, verdict: { item: 'x', results: [{ ...met('a'), status: 'NOT MET' }, full.results[1]] } })[0], /a is NOT MET/);
  assert.match(checkVerdict({ item: 'x', head, verdict: { item: 'x', results: [met('a'), met('b', { test: 'verify/x/b.test.mjs' })] } })[0], /b is builder-proven, so it needs a mutation/);
  assert.match(checkVerdict({ item: 'x', head, verdict: { item: 'x', results: [met('a', { excerpt: ' ' }), full.results[1]] } })[0], /no output excerpt/);
  assert.match(checkVerdict({ item: 'x', head, verdict: { ...full, item: 'y' } })[0], /for item y/);
});

test('the contract ignores status and done_on but sees the head and the Verifier brief', () => {
  assert.equal(contract(item(head)), contract(item({ ...head, status: 'done', done_on: '2026-11-08' })));
  assert.notEqual(contract(item(head)), contract(item({ ...head, expect: [head.expect[0]] })));
  assert.notEqual(contract(item(head)), contract(item(head, 'Skim it.')));
});

test('the freeze refuses a changed contract unless the PR is a plan-only replan', () => {
  const frozen = [{ id: 'x', before: item(head), after: item({ ...head, expect: [head.expect[0]] }) }];
  const changed = ['plan/items/x.md', 'packages/a/index.js'];
  assert.match(checkFreeze({ changed, frozen, labels: [] })[0], /changes the contract of x/);
  assert.match(checkFreeze({ changed, frozen, labels: ['replan'] })[0], /touches packages\/a\/index.js/);
  assert.deepEqual(checkFreeze({ changed: ['plan/items/x.md'], frozen, labels: ['replan'] }), []);
  assert.deepEqual(checkFreeze({ changed, frozen: [{ id: 'x', before: item(head), after: item({ ...head, status: 'done' }) }], labels: [] }), []);
});

test('once a verdict file exists, the freeze refuses a changed contract even from a plan-only replan', () => {
  const after = item({ ...head, expect: [head.expect[0]] });
  const frozen = [{ id: 'x', before: item(head), after, verdict: 'verify/x/verdict.json' }];
  const reasons = checkFreeze({ changed: ['plan/items/x.md'], frozen, labels: ['replan'] });
  assert.equal(reasons.length, 1);
  assert.match(reasons[0], /changes the contract of x .*verify\/x\/verdict.json exists/);
  assert.deepEqual(checkFreeze({ changed: ['plan/items/x.md'], frozen: [{ ...frozen[0], after: item({ ...head, status: 'done' }) }], labels: ['replan'] }), []);
});

const three = { id: 'x', expect: [{ id: 'w', proof: 'world' }, { id: 'v', proof: 'verifier' }, { id: 'b', proof: 'builder' }] };
const proven = (extra = {}) => ({
  item: 'x', results: [met('w'), met('v', { test: 'verify/x/v.test.mjs' }),
    met('b', { test: 'verify/x/b.test.mjs', test_name: 'bites', mutation: 'return 0', red_test: 'adds' })], ...extra,
});

test('a verifier or builder result names its test under verify/<item>/; a world result need not', () => {
  assert.deepEqual(checkVerdict({ item: 'x', head: three, verdict: proven() }), []);
  for (const [id, test, why] of [['v', undefined, /v is verifier-proven, so it names the test that proves it: test is missing/],
    ['b', undefined, /b is builder-proven, so it names the test that proves it: test is missing/],
    ['v', 'test/v.test.mjs', /test test\/v.test.mjs is not a path under verify\/x\//],
    ['v', 'verify/y/v.test.mjs', /not a path under verify\/x\//],
    ['v', 'verify/x/../../v.test.mjs', /not a path under verify\/x\//]]) {
    const verdict = proven();
    const r = verdict.results.find((x) => x.id === id);
    if (test === undefined) delete r.test; else r.test = test;
    const reasons = checkVerdict({ item: 'x', head: three, verdict });
    assert.equal(reasons.length, 1, `${id} ${test}: ${reasons}`);
    assert.match(reasons[0], why);
  }
});

test('observations never gate, but are a list of strings when present', () => {
  assert.deepEqual(checkVerdict({ item: 'x', head: three, verdict: proven({ observations: ['the README is long'] }) }), []);
  assert.deepEqual(checkVerdict({ item: 'x', head: three, verdict: proven({ observations: [] }) }), []);
  assert.match(checkVerdict({ item: 'x', head: three, verdict: proven({ observations: 'long' }) })[0], /observations is a list/);
});

test('the tests to run: one per file and name, with the Expect ids they prove; never a world line', () => {
  const verdict = proven();
  verdict.results[0].test = 'verify/x/w.test.mjs';
  assert.deepEqual(verdictTests({ head: three, verdict }), [
    { file: 'verify/x/v.test.mjs', name: null, ids: ['v'] },
    { file: 'verify/x/b.test.mjs', name: 'bites', ids: ['b'] },
  ]);
  const shared = { ...three, expect: [...three.expect, { id: 'v2', proof: 'verifier' }] };
  verdict.results.push(met('v2', { test: 'verify/x/v.test.mjs' }));
  assert.deepEqual(verdictTests({ head: shared, verdict })[0], { file: 'verify/x/v.test.mjs', name: null, ids: ['v', 'v2'] });
});

test('a named test fails the gate when it exits non-zero or passes nothing', () => {
  const run = { file: 'verify/x/v.test.mjs', name: null, ids: ['v'] };
  assert.equal(testRunFault(run, { status: 0, output: '# tests 2\n# pass 2\n# fail 0\n' }), null);
  assert.match(testRunFault(run, { status: 1, output: 'not ok 1 - adds\n# pass 1\n# fail 1\n' }), /Expect v: test verify\/x\/v.test.mjs fails at the head \(exit 1\): not ok 1 - adds/);
  assert.match(testRunFault({ ...run, name: 'nope' }, { status: 0, output: '# tests 0\n# pass 0\n' }), /\(nope\) ran no test that passed/);
});

test('a PR names its item by body line or branch', () => {
  const ids = new Set(['x', 'y']);
  assert.equal(namedItem({ branch: 'build/x', body: '', ids }).item, 'x');
  assert.equal(namedItem({ branch: 'claude/thread-1', body: 'Builds it.\nItem: y\n', ids }).item, 'y');
  assert.equal(namedItem({ branch: 'chore/z', body: '', ids }).item, null);
  assert.match(namedItem({ branch: 'build/x', body: 'Item: y', ids }).reasons[0], /body names y but the branch names x/);
  assert.match(namedItem({ branch: 'a', body: 'Item: q', ids }).reasons[0], /doesn't have/);
});

test('the verdict session must differ from every builder session', () => {
  const s = (n) => `msg\n\nClaude-Session: https://claude.ai/code/session_${n}\n`;
  assert.equal(sessionOf(s(1)), 'https://claude.ai/code/session_1');
  const builder = [{ sha: 'b1b1b1b1', message: s(1), files: ['a.js'] }];
  assert.deepEqual(checkSessions({ item: 'x', verdictCommit: { sha: 'v', message: s(2) }, builderCommits: builder, afterVerified: [] }), []);
  assert.match(checkSessions({ item: 'x', verdictCommit: { sha: 'v', message: s(1) }, builderCommits: builder, afterVerified: [] })[0], /same Claude-Session as builder commit b1b1b1b/);
  assert.match(checkSessions({ item: 'x', verdictCommit: { sha: 'vvvvvvv', message: 'no trailer' }, builderCommits: builder, afterVerified: [] })[0], /no Claude-Session/);
  assert.match(checkSessions({ item: 'x', verdictCommit: { sha: 'v', message: s(2) }, builderCommits: builder, afterVerified: builder })[0], /changes a.js after the verified sha/);
});

test('the history ban finds item ids, lanes, rounds and grafts in harness source and its READMEs, not in tests or plan/', () => {
  const files = [
    { path: 'packages/engine/src/a.js', text: 'ok\n// (plan item fix-x)' },
    { path: 'packages/engine/bin/host.js', text: '// the pin (design A, 4.3)' },
    { path: 'packages/journal/src/b.js', text: '// grafted from lane M' },
    { path: 'plugins/harness/scripts/c.mjs', text: '// a rebuild (fix-rebuild-worktree) works on its branch' },
    { path: 'scripts/inspector/export.mjs', text: '// round 2 of the tournament' },
    { path: 'scripts/bench/lib.mjs', text: '// as before stage-prompt-files' },
    { path: 'packages/engine/README.md', text: 'The host (plan item engine-host).' },
    { path: 'plugins/harness/README.md', text: 'Capture (obs-live-capture), on every hook.' },
    { path: 'scripts/inspector/test/export.test.mjs', text: "test('lane A Q1: the brief', () => {})" },
    { path: 'packages/engine/src/vendor/x.js', text: '// round 1' },
    { path: 'packages/engine/test/a.test.js', text: '// (plan item fix-x)' },
    { path: 'plan/items/x.md', text: '// (plan item fix-x)' },
    { path: 'docs/journal.md', text: 'defined by plan item fix-x' },
    { path: 'packages/engine/src/clean.js', text: '// A rebuild works on the PR\'s branch at its head; the round limit is two.' },
  ];
  const rule = 'a history reference (comments say what holds now; item ids go in commits, PRs and the plan)';
  assert.deepEqual(findStubs(files), [
    `packages/engine/src/a.js:2 has ${rule}`,
    `packages/engine/bin/host.js:1 has ${rule}`,
    `packages/journal/src/b.js:1 has ${rule}`,
    `plugins/harness/scripts/c.mjs:1 has ${rule}`,
    `scripts/inspector/export.mjs:1 has ${rule}`,
    `scripts/bench/lib.mjs:1 has ${rule}`,
    `packages/engine/README.md:1 has ${rule}`,
    `plugins/harness/README.md:1 has ${rule}`,
  ]);
});

test('the stub ban finds markers and skipped tests only under packages/ and plugins/', () => {
  const files = [
    { path: 'packages/a/x.js', text: 'ok\n// TODO later' },
    { path: 'plugins/p/y.js', text: "throw new Error('Not implemented')" },
    { path: 'packages/a/test/z.test.js', text: "test.skip('later', () => {})" },
    { path: 'packages/a/test/w.test.js', text: "test('later', { skip: true }, () => {})" },
    { path: 'packages/a/test/v.test.js', text: "test('later', (t) => { t.skip('no') })" },
    { path: 'scripts/s.js', text: '// TODO fine here' },
    { path: 'packages/a/clean.js', text: 'export const todos = []; // a list of todo items' },
  ];
  assert.deepEqual(findStubs(files), [
    'packages/a/x.js:2 has TODO',
    'plugins/p/y.js:1 has "not implemented"',
    'packages/a/test/z.test.js:1 has a skipped test',
    'packages/a/test/w.test.js:1 has a skipped test',
    'packages/a/test/v.test.js:1 has a skipped test',
  ]);
});
