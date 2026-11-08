// Expect cutoff-refused: the verdict gate refuses a verdict when the item's contract at verified_sha differs from the
// head's, after a side branch is merged into the build branch, naming the item and the field; it passes when the side
// branch changes only status, done_on or another plan file; it refuses when the item file is absent at verified_sha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BUILDER, PASSING_TEST, VERIFIER, itemText, tempRepo } from './lib.mjs';

const verdictJson = (verified) => JSON.stringify({
  item: 'x', verified_sha: verified, verifier: { session: 'https://claude.ai/code/session_verifier' },
  results: [{ id: 'e1', status: 'MET', command: 'node --test verify/x/pass.test.mjs', excerpt: '1/1 pass',
    test: 'verify/x/pass.test.mjs' }],
}, null, 2);

/**
 * base: item x ready (unless withItem is false) and another plan file; build/x: status done, a source change and a
 * passing test from the builder (verified_sha), then verdict.json from another session. side(files) branches from
 * the base, commits files, merges into build/x (their side wins a conflict) and runs the verdict gate as main would.
 */
function world(t, { withItem = true } = {}) {
  const r = tempRepo(t, { ...(withItem ? { 'plan/items/x.md': itemText() } : {}), 'plan/items/other.md': itemText({ id: 'other' }),
    'src/a.js': 'export const a = 1;\n' });
  r.git('checkout', '-q', '-b', 'build/x');
  const verified = r.commit({ ...(withItem ? { 'plan/items/x.md': itemText({ status: 'done' }) } : {}),
    'src/a.js': 'export const a = 2;\n', 'verify/x/pass.test.mjs': PASSING_TEST }, `build x\n\n${BUILDER}`);
  r.commit({ 'verify/x/verdict.json': verdictJson(verified) }, `verify x\n\n${VERIFIER}`);
  return {
    ...r, verified,
    side(files) {
      r.git('checkout', '-q', '-b', `side-${Math.random().toString(36).slice(2)}`, r.base);
      const tip = r.commit(files, 'side');
      r.git('checkout', '-q', 'build/x');
      r.git('merge', '-q', '--no-edit', '-X', 'theirs', tip);
      const merge = r.git('rev-parse', 'HEAD');
      return r.gate('verdict', { BASE_SHA: tip, HEAD_SHA: merge, PR_BODY: 'Item: x', PR_LABELS: '[]' });
    },
  };
}

test('control: the verdict passes at the build tip with no side merge', (t) => {
  const w = world(t);
  const r = w.gate('verdict', { BASE_SHA: w.base, HEAD_SHA: '', PR_BODY: 'Item: x', PR_LABELS: '[]' });
  assert.equal(r.status, 0, r.out);
});

test('a merged side branch that rewords an Expect check: exit 1, names x and expect', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ check: 'a reworded thing holds' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /contract of x moved/);
  assert.match(r.out, /\bexpect\b/);
  assert.match(r.out, new RegExp(w.verified.slice(0, 7)));
});

test('a merged side branch that rewords the Verifier brief: exit 1, names Verifier brief', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ brief: 'Run a different test.' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /contract of x moved[^\n]*Verifier brief/);
  assert.doesNotMatch(r.out, /\(expect/);
});

test('a merged side branch that changes only status: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ status: 'done' }) });
  assert.equal(r.status, 0, r.out);
  assert.match(w.git('show', 'HEAD:plan/items/x.md'), /"status": "done"/, 'the status change reached the head');
});

test('a merged side branch that changes only done_on: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/x.md': itemText({ done_on: '2026-11-08' }) });
  assert.equal(r.status, 0, r.out);
  assert.match(w.git('show', 'HEAD:plan/items/x.md'), /"done_on": "2026-11-08"/, 'the done_on change reached the head');
});

test('a merged side branch that changes only another plan file: exit 0', (t) => {
  const w = world(t);
  const r = w.side({ 'plan/items/other.md': itemText({ id: 'other', check: 'reworded other' }), 'plan/notes.md': 'a note\n' });
  assert.equal(r.status, 0, r.out);
});

test('a verdict whose verified_sha predates the item file: exit 1', (t) => {
  const w = world(t, { withItem: false });
  const r = w.side({ 'plan/items/x.md': itemText({ status: 'done' }) });
  t.diagnostic(r.out.trim());
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /plan\/items\/x\.md does not exist at the verified sha/);
});
