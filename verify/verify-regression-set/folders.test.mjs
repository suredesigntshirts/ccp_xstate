// folders-hold-verdicts: at the head every done item's verify/ folder at the base holds verdict.json and nothing else,
// its item naming the folder; no folder under verify/ holds a test file but this item's and not-done items'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, ID, REPO, doneAtBase, gitDir, headOf, isTest, walk } from './lib.mjs';

const statusAtHead = (f) => { const p = join(REPO, 'plan/items', `${f}.md`); return existsSync(p) ? headOf(readFileSync(p, 'utf8')).status : null; };

test('folders-hold-verdicts: each done folder at the base holds only verdict.json at the head, naming its folder', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
  const done = doneAtBase();
  assert.ok(done.length >= 80, `${done.length} done folders`);
  for (const f of done) {
    const dir = join(REPO, 'verify', f);
    assert.deepEqual(walk(dir, dir), ['verdict.json'], f);
    const v = JSON.parse(readFileSync(join(dir, 'verdict.json'), 'utf8'));
    assert.equal(v.item, f, `${f}/verdict.json item`);
  }
  t.diagnostic(`${done.length} folders hold verdict.json alone`);
});

test('folders-hold-verdicts: no folder under verify/ holds a test file but this item\'s and those of items not done', (t) => {
  const holders = readdirSync(join(REPO, 'verify')).filter((f) => walk(join(REPO, 'verify', f)).some(isTest));
  const wrong = holders.filter((f) => f !== ID && statusAtHead(f) === 'done');
  assert.deepEqual(wrong, []);
  t.diagnostic(`folders holding tests: ${holders.join(', ')}`);
});

test('folders-hold-verdicts: the reader sees a second file and a done holder (control)', () => {
  const dir = join(REPO, 'verify', ID);
  assert.ok(walk(dir, dir).length > 1);
  assert.equal(statusAtHead('verify-regression-plugin'), 'done');
  assert.equal(statusAtHead('no-such-item'), null);
});
