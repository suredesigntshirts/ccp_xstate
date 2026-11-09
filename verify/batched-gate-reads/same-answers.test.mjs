// same-answers: for each PR built here, the base pr-gate.mjs and the head's give the same exit code, stdout and stderr
// for the freeze, stubs, evidence and verdict gates. Every repo starts from this checkout's plan/, scripts/, packages/,
// plugins/ and verify/, so the freeze gate reads the real 100-plus items.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GATES, HEAD_GATE, REPO, baseGate, runGate, seededRepo } from './lib.mjs';

const BINARY = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff, 0xfe, 0xc3, 0x28, 0x0a, 0x00, 0x0a, 0x0a]);
const itemText = (head, brief = 'Run it.') => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n\n## Verifier brief\n\n${brief}\n`;
const newItem = (id, status = 'ready') => itemText({ id, title: id, status, expect: [{ id: 'a', check: 'holds', proof: 'verifier' }] });
const read = (p) => readFileSync(join(REPO, p), 'utf8');

/** Runs every gate with both scripts and asserts they agree; returns the head's answers for the caller to check. */
function same(t, repo, env = {}) {
  const base = baseGate(t);
  const answers = {};
  for (const which of GATES) {
    const before = runGate(base, which, repo, env);
    const after = runGate(HEAD_GATE, which, repo, env);
    const strip = ({ status, stdout, stderr }) => ({ status, stdout, stderr });
    assert.deepEqual(strip(after), strip(before), `${which} gate differs`);
    answers[which] = strip(after);
  }
  return answers;
}

test('a PR that changes a done, verified item\'s Expect lines and a done item\'s done_on', (t) => {
  const r = seededRepo(t);
  const p = 'plan/items/pr-test-selection.md';
  r.write(p, read(p).replace('"check": "', '"check": "Softer: '));
  const d = 'plan/items/fix-workflow-pinned.md';
  r.write(d, read(d).replace(/"done_on": "[^"]*"/, '"done_on": "2027-01-01"'));
  r.write('plan/items/x.md', newItem('x'));
  r.commit('soften\n\nClaude-Session: builder');
  const a = same(t, r);
  assert.equal(a.freeze.status, 1);
  assert.match(a.freeze.stderr, /pr-test-selection/);
  assert.match(a.freeze.stderr, /fix-workflow-pinned/);
  // The same change as a plan-only replan.
  assert.equal(same(t, r, { PR_LABELS: '["replan"]', PR_BODY: '' }).freeze.status, 1);
});

test('a PR that adds items and deletes a draft, a done and a verified item', (t) => {
  const r = seededRepo(t);
  r.write('plan/items/x.md', newItem('x'));
  r.write('plan/items/y.md', newItem('y', 'done'));
  r.remove('plan/items/refine-leftovers.md');
  r.remove('plan/items/plan-independent-review.md');
  r.remove('plan/items/pr-test-selection.md');
  r.commit('churn\n\nClaude-Session: builder');
  const a = same(t, r);
  assert.equal(a.freeze.status, 1);
  assert.match(a.freeze.stderr, /pr-test-selection/);
  same(t, r, { PR_LABELS: '["replan"]', PR_BODY: '' });
});

test('a PR that deletes a verdict file, alone and beside its item\'s file', (t) => {
  const r = seededRepo(t);
  r.remove('verify/pr-test-selection/verdict.json');
  r.commit('drop verdict\n\nClaude-Session: builder');
  same(t, r, { PR_BODY: 'Item: pr-test-selection\n' });
  same(t, r);
  r.write('plan/items/pr-test-selection.md', read('plan/items/pr-test-selection.md').replace('"status": "done"', '"status": "ready"'));
  r.commit('and its status\n\nClaude-Session: builder');
  same(t, r, { PR_BODY: 'Item: pr-test-selection\n' });
});

test('a PR that touches paths with spaces, quotes, non-ASCII and "missing" in their names', (t) => {
  const r = seededRepo(t, {
    prep(s) {
      s.write('plan/items/sp ace.md', newItem('sp ace', 'done'));
      s.write('plan/items/item missing.md', newItem('item missing', 'done'));
      s.write('verify/sp ace/verdict.json', '{}\n');
    },
  });
  r.write('plan/items/sp ace.md', newItem('sp ace', 'done').replace('holds', 'softer'));
  r.write('plan/items/item missing.md', newItem('item missing', 'done').replace('holds', 'softer'));
  r.write('packages/a b/c d.js', '// TODO: later\n');
  r.write('packages/x missing', '// FIXME\n');
  r.write('packages/x ambiguous', '// FIXME too\n');
  r.write('packages/café/über.js', '// TODO\n');
  r.write('packages/q"uote.js', '// TODO\n');
  r.write('scripts/inspector/a b.mjs', '// added in plan item x\n');
  r.write('verify/x/evidence/a b.md', 'ran it\n');
  r.write('plan/items/x.md', newItem('x'));
  r.commit('names\n\nClaude-Session: builder');
  const a = same(t, r);
  assert.equal(a.stubs.status, 1);
  assert.match(a.stubs.stderr, /packages\/a b\/c d\.js:1 has TODO/);
  assert.match(a.stubs.stderr, /packages\/x missing:1 has FIXME/);
  assert.match(a.stubs.stderr, /scripts\/inspector\/a b\.mjs:1 has a history reference/);
  assert.equal(a.freeze.status, 1);
  assert.match(a.freeze.stderr, /sp ace/);
  assert.match(a.freeze.stderr, /item missing/);
});

test('a PR that adds non-text files, symlinks, a submodule and a folder named like an item', (t) => {
  const r = seededRepo(t);
  r.write('packages/engine/logo.png', BINARY);
  r.write('scripts/inspector/blob.bin', Buffer.concat([BINARY, Buffer.from('lane A\n')]));
  r.write('verify/x/evidence/blob.bin', BINARY);
  r.write('verify/x/evidence/big.md', 'y'.repeat(70 * 1024));
  r.write('verify/x/evidence/run.pass', 'ok\n');
  // A spec-reporter listing, which only reads as one when its non-ASCII marks decode as UTF-8.
  r.write('verify/x/evidence/spec.md', `${Array.from({ length: 10 }, (_, i) => `\u2714 case ${i} (1ms)`).join('\n')}\n\u2139 pass 10\n\u2139 fail 0\n`);
  r.link('../README.md', 'packages/link.js');
  r.link('../../plan/README.md', 'verify/x/evidence/link.md');
  r.gitlink('packages/sub', r.base);
  r.gitlink('verify/x/sub', r.base);
  r.write('plan/items/folder.md/inner.md', 'not an item\n');
  r.write('plan/items/x.md', newItem('x'));
  r.commit('binary\n\nClaude-Session: builder');
  const a = same(t, r);
  assert.equal(a.evidence.status, 1);
  assert.match(a.evidence.stderr, /blob\.bin|big\.md/);
  assert.match(a.evidence.stderr, /submodule|symlink/);
  assert.match(a.evidence.stderr, /spec\.md is a test listing/);
});

test('a PR that adds a stub under scripts/, packages/ and plugins/, then removes it', (t) => {
  const r = seededRepo(t);
  r.write('scripts/bench/new.mjs', 'export const x = 1; // graft from lane B\n');
  r.write('packages/engine/src/new.js', 'export function f() { throw new Error("not implemented"); }\n');
  r.write('plugins/harness/scripts/new.mjs', "test.skip('later', () => {});\n");
  r.write('plan/items/x.md', newItem('x'));
  r.commit('stubs\n\nClaude-Session: builder');
  const a = same(t, r);
  assert.equal(a.stubs.status, 1);
  assert.equal(a.stubs.stderr.trim().split('\n').length, 4, a.stubs.stderr);
  r.remove('scripts/bench/new.mjs');
  r.remove('packages/engine/src/new.js');
  r.remove('plugins/harness/scripts/new.mjs');
  r.commit('clean\n\nClaude-Session: builder');
  assert.equal(same(t, r).stubs.status, 0);
});

test('a build PR with a verdict from a separate session, then one from the builder, then a late commit', (t) => {
  const r = seededRepo(t);
  r.write('plan/items/x.md', newItem('x', 'done'));
  r.write('packages/a/index.js', 'export const a = 1;\n');
  const built = r.commit('build\n\nClaude-Session: builder');
  r.write('verify/x/a.test.mjs', "import { test } from 'node:test';\ntest('a holds', () => {});\n");
  r.write('verify/x/verdict.json', JSON.stringify({ item: 'x', verified_sha: built,
    results: [{ id: 'a', status: 'MET', command: 'node --test verify/x/a.test.mjs', excerpt: '1 pass', test: 'verify/x/a.test.mjs' }] }));
  r.commit('verdict\n\nClaude-Session: verifier');
  let a = same(t, r);
  assert.equal(a.verdict.status, 0, a.verdict.stderr);
  assert.equal(a.freeze.status, 0, a.freeze.stderr);
  r.write('verify/x/verdict.json', readFileSync(join(r.dir, 'verify/x/verdict.json'), 'utf8') + '\n');
  r.commit('verdict again\n\nClaude-Session: builder');
  assert.equal(same(t, r).verdict.status, 1);
  r.write('packages/a/index.js', 'export const a = 2;\n');
  r.commit('late\n\nClaude-Session: verifier');
  a = same(t, r);
  assert.equal(a.verdict.status, 1);
  assert.match(a.verdict.stderr, /after the verified sha/);
});

test('the PR\'s own change: the base plan and scripts, with this checkout\'s files as the head', (t) => {
  const r = seededRepo(t, {
    prep(s) {
      s.write('scripts/gates/pr-gate.mjs', read('verify/batched-gate-reads/evidence/base-pr-gate.mjs.txt'));
      s.remove('verify/batched-gate-reads'); // so the verdict gate does not run this suite inside itself
    },
  });
  r.write('scripts/gates/pr-gate.mjs', read('scripts/gates/pr-gate.mjs'));
  r.commit('batched reads\n\nClaude-Session: builder');
  for (const body of ['Item: batched-gate-reads\n', '']) {
    const a = same(t, r, { PR_BODY: body });
    assert.equal(a.stubs.status, 0, a.stubs.stderr);
  }
});
