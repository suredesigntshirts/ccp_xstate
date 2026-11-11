// The overhead view (plan item obs-time-and-rework, Expect `overhead`): paths the config lists count as harness,
// everything else as product, and changing the config moves the split. The PRs are the real ccp_xstate PRs in the
// rework fixture; the token rows are made here, one session per PR author.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { globRegex, isHarness, overhead, sessionKey } from '../src/derive/overhead.js';

const facts = JSON.parse(readFileSync(new URL('./fixtures/derive/ccp_xstate-prs.json', import.meta.url), 'utf8'));
const config = JSON.parse(readFileSync(new URL('../harness-paths.json', import.meta.url), 'utf8'));
const pr28 = facts.find((f) => f.number === 28);
const usage = (session, id, tokens) => ({ id, session, kind: 'turn.usage', at: '2026-10-30T17:00:00.000Z', payload: { tokens } });
const rows = [
  usage(pr28.sessions[0], 'u1', { input: 100, output: 900, cacheRead: 0, cacheCreation: 0 }),
  { id: 'a1', session: pr28.sessions[0], kind: 'agent.finish', at: '2026-10-30T17:01:00.000Z', payload: { tokens: { input: 0, output: 1000 } } },
  usage('session_without_pr', 'u2', { input: 50, output: 50 }),
];
// A product PR: one file in the product repo, one harness file (CLAUDE.md) in it.
const product = { repo: 'acme/shop', number: 7, sessions: ['session_product'], files: [{ path: 'src/cart.js', changes: 30 }, { path: 'CLAUDE.md', changes: 10 }] };

test('globs: ** spans folders, * stays in one', () => {
  assert.ok(globRegex('a/b/**').test('a/b/c/d.js'));
  assert.ok(globRegex('*/*/CLAUDE.md').test('acme/shop/CLAUDE.md'));
  assert.ok(!globRegex('*/*/CLAUDE.md').test('acme/shop/docs/CLAUDE.md'));
  assert.ok(isHarness('suredesigntshirts/ccp_xstate/plan/README.md', config));
  assert.ok(!isHarness('acme/shop/src/cart.js', config));
});

test('with the shipped config, this repo is harness, a product repo is product, a session with no PR is unattributed', () => {
  const view = overhead([...rows, usage('session_product', 'u3', { input: 400 })], [pr28, product], config);
  assert.equal(view.sessions[pr28.sessions[0]].harnessShare, 1);
  assert.equal(view.sessions.session_product.harnessShare, 10 / 40);
  assert.deepEqual([view.harness, view.product, view.unattributed], [2000 + 100, 300, 100]);
  assert.deepEqual(view.sessions[pr28.sessions[0]].inputs, { rows: ['u1', 'a1'], prs: ['suredesigntshirts/ccp_xstate#28'] });
});

test('changing the config moves the split', () => {
  const narrow = { harness: ['suredesigntshirts/ccp_xstate/plan/**'] };
  const lines = (pred) => pr28.files.filter(pred).reduce((n, f) => n + Math.max(1, f.changes), 0);
  const share = lines((f) => f.path.startsWith('plan/')) / lines(() => true);
  assert.ok(share > 0 && share < 1);
  const view = overhead(rows, [pr28], narrow);
  assert.equal(view.sessions[pr28.sessions[0]].harnessShare, share);
  assert.equal(view.harness, Math.round(2000 * share));
  assert.equal(view.harness + view.product + view.unattributed, 2100);
  assert.notEqual(view.harness, overhead(rows, [pr28], config).harness);
});

// Rows key a session by its cloud URL or by its id, and trailers name it in four forms: all meet on one key.
test('a session meets its PRs whatever form the rows and the trailers name it in', () => {
  const url = (id) => `https://claude.ai/code/${id}`;
  const pr = (number, sessions) => ({ repo: 'acme/shop', number, sessions, files: [{ path: 'src/a.js', changes: 3 }, { path: 'CLAUDE.md', changes: 1 }] });
  const view = overhead([
    usage(url('session_A'), 'r1', { input: 10 }),
    usage('session_B', 'r2', { input: 20 }),
    usage(url('session_C'), 'r3', { input: 30 }),
    usage('session_C', 'r4', { input: 5 }),
    usage('local-1234-abcd', 'r5', { input: 40 }),
    usage(url('session_D'), 'r6', { input: 50 }),
    usage('session_E', 'r7', { input: 60 }),
  ], [
    pr(1, ['session_A']),
    pr(2, [url('session_B')]),
    pr(3, [`${url('session_C')}#agent=verifier`, 'session_C']),
    pr(4, ['local-1234-abcd']),
    pr(5, [`${url('session_D')}#agent=builder`]),
  ], config);
  const ids = ['session_A', 'session_B', 'session_C', 'local-1234-abcd', 'session_D'];
  assert.deepEqual(Object.keys(view.sessions).sort(), [...ids, 'session_E'].sort());
  ids.forEach((id, i) => {
    assert.deepEqual(view.sessions[id].inputs.prs, [`acme/shop#${i + 1}`], id);
    assert.equal(view.sessions[id].harnessShare, 1 / 4, id);
  });
  assert.deepEqual(view.sessions.session_C.inputs.rows, ['r3', 'r4']);
  assert.equal(view.sessions.session_E.harnessShare, null);
  assert.equal(view.unattributed, 60);
});

test('sessionKey reads every form to one key', () => {
  for (const s of ['https://claude.ai/code/session_X', 'session_X', 'https://claude.ai/code/session_X#agent=v']) assert.equal(sessionKey(s), 'session_X');
  assert.equal(sessionKey('http://localhost:8080/code/session_X#agent=v'), 'session_X');
  assert.equal(sessionKey('3f2a-local'), '3f2a-local');
});
