// Expect suite-and-scope: node plan/check.mjs passes at the checkout, and the PR changes only the files the item's
// outputs name, its own item file, its decisions file and verify/rule-text-tests/. On this item's own PR (PR_BODY's
// Item: line names it, as the verdict job sets it with BASE_SHA) the file list is read from git, against BASE_SHA or
// else origin/main; every other run (ci.yml's depth-1 checkout, any later clone) checks what it can from the tree.
// npm test itself is run by ci; this file is part of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ITEM, REPO, headOf, node, read } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const head = headOf(read(`plan/items/${ITEM}.md`));
const outputs = head.outputs.flatMap((o) => o.ref.split(/,\s*/));
const ALSO = [`plan/items/${ITEM}.md`, 'plan/decisions/2026-11-08-refine-round-8.md'];
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const ownPr = namedItem({ body: process.env.PR_BODY, ids: new Set([ITEM]) }).item === ITEM;

function changedFiles() {
  if (!ownPr) return null;
  for (const base of [process.env.BASE_SHA, 'origin/main'].filter(Boolean)) {
    try { return git('diff', '--name-only', '--no-renames', git('merge-base', base, 'HEAD'), 'HEAD').split('\n').filter(Boolean); } catch {}
  }
  return null;
}

test('node plan/check.mjs passes', (t) => {
  const r = node([join(REPO, 'plan/check.mjs')]);
  t.diagnostic(r.out.trim().split('\n').slice(-1)[0]);
  assert.equal(r.status, 0, r.out);
});

test('the item is done', () => {
  assert.equal(head.status, 'done');
});

test('the PR changes only its outputs, its item, its decisions file and its verify folder', (t) => {
  const changed = changedFiles();
  if (!changed) {
    t.diagnostic(ownPr ? 'tree mode: no base reachable' : `tree mode: PR_BODY does not name ${ITEM}`);
    assert.deepEqual(outputs, ['docs/layout.md']);
    return;
  }
  t.diagnostic(`PR mode: ${changed.length} files: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => !outputs.includes(p) && !ALSO.includes(p) && !p.startsWith(`verify/${ITEM}/`)), []);
});
