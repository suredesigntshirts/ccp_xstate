// Expect plan-and-suite-pass: node plan/check.mjs passes on the head's real plan, and the PR changes only the files
// the item's outputs name and no verify/ folder of another item. npm test itself is run by ci (this file is part of
// it). On this item's own PR (PR_BODY's Item: line names it, as the verdict job sets it with BASE_SHA) the file list
// comes from git against the merge base with BASE_SHA, else origin/main. Every other run (ci.yml's depth-1 checkout,
// a full clone of any branch, another item's PR) checks that each output exists in the tree.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, read, splitItem } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const ITEM = 'plan-reader-effort';
const outputs = splitItem(read(`plan/items/${ITEM}.md`)).head.outputs.flatMap((o) => o.ref.split(/,\s*/));
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const ownPr = namedItem({ body: process.env.PR_BODY, ids: new Set([ITEM]) }).item === ITEM;
function changedFiles() {
  if (!ownPr) return null;
  for (const base of [process.env.BASE_SHA, 'origin/main'].filter(Boolean)) {
    try {
      return git('diff', '--name-only', '--no-renames', git('merge-base', base, 'HEAD'), 'HEAD').split('\n').filter(Boolean);
    } catch {}
  }
  return null;
}

test('node plan/check.mjs passes on the real plan', (t) => {
  const r = node([join(REPO, 'plan/check.mjs')], { cwd: REPO });
  t.diagnostic(r.out.trim().split('\n').slice(-2).join(' / '));
  assert.equal(r.status, 0, r.out);
});

test('the PR changes only the files its outputs name, and no other item\'s verify/ folder', (t) => {
  for (const p of outputs) assert.ok(existsSync(join(REPO, p)), `${p} exists`);
  const changed = changedFiles();
  if (!changed) return t.diagnostic(ownPr ? 'tree mode: no base reachable; every output exists in the tree'
    : `tree mode: PR_BODY does not name ${ITEM}; every output exists in the tree`);
  const allowed = (p) => outputs.includes(p) || p === `plan/items/${ITEM}.md` || p.startsWith(`verify/${ITEM}/`);
  t.diagnostic(`PR mode: ${changed.length} files: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => !allowed(p)), []);
});
