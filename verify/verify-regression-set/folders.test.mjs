// folders-hold-verdicts: at the head every done item's verify/ folder at the base holds verdict.json and nothing else,
// its item naming the folder; no folder under verify/ holds a test file but this item's and not-done items'. "The
// head" is the verified commit's tree, read with git, so a later merge with main (ci tests the merge ref) that brings
// in an item done after the base does not change the answer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, ID, VERIFIED, doneAtBase, gitDir, headOf, isTest, lsTree, show } from './lib.mjs';

const statusAt = (sha, f) => { try { return headOf(show(sha, `plan/items/${f}.md`)).status; } catch { return null; } };

test('folders-hold-verdicts: each done folder at the base holds only verdict.json at the head, naming its folder', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
  const done = doneAtBase();
  assert.ok(done.length >= 80, `${done.length} done folders`);
  for (const f of done) {
    assert.deepEqual(lsTree(VERIFIED, `verify/${f}`), [`verify/${f}/verdict.json`], f);
    const v = JSON.parse(show(VERIFIED, `verify/${f}/verdict.json`));
    assert.equal(v.item, f, `${f}/verdict.json item`);
  }
  t.diagnostic(`${done.length} folders hold verdict.json alone at ${VERIFIED.slice(0, 7)}`);
});

test('folders-hold-verdicts: no folder under verify/ holds a test file but this item\'s and those of items not done', (t) => {
  if (!gitDir()) return t.skip(`head ${VERIFIED} not readable here`);
  const holders = [...new Set(lsTree(VERIFIED, 'verify').filter(isTest).map((p) => p.split('/')[1]))];
  assert.deepEqual(holders.filter((f) => f !== ID && statusAt(VERIFIED, f) === 'done'), []);
  t.diagnostic(`folders holding tests at ${VERIFIED.slice(0, 7)}: ${holders.join(', ') || 'none'}`);
});

test('folders-hold-verdicts: the reader sees a second file and a done holder (control)', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
  assert.ok(lsTree(BASE, 'verify/verify-regression-plugin').length > 1, 'the base folder held more than its verdict');
  assert.equal(statusAt(BASE, 'verify-regression-plugin'), 'done');
  assert.equal(statusAt(BASE, 'no-such-item'), null);
});
