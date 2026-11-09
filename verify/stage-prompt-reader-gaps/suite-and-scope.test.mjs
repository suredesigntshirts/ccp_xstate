// Expect suite-and-scope: node plan/check.mjs passes at the checkout, and the PR changes only the files the item's
// outputs name, its own item file, its decisions file and verify/stage-prompt-reader-gaps/. Outputs that name a folder cover what is under
// it. On this item's own PR (PR_BODY's Item: line names it) the file list is read from git, against BASE_SHA or else
// origin/main; any other run (ci.yml's depth-1 checkout, a later clone) checks the outputs exist. npm test as a whole
// is run by ci.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { ITEM, REPO, node, read } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const head = JSON.parse(read(`plan/items/${ITEM}.md`).match(/^```json\n([\s\S]*?)\n```\n/)[1]);
// An output's ref may list several paths, comma- or semicolon-separated.
const outputs = head.outputs.flatMap((o) => o.ref.split(/[,;]\s*/)).map((p) => p.trim());
const covered = (p) => outputs.some((o) => (o.endsWith('/') ? p.startsWith(o) : p === o))
  || p === `plan/items/${ITEM}.md` || p === `plan/decisions/2026-11-09-${ITEM}.md` || p.startsWith(`verify/${ITEM}/`);
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 }).trim();
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
  t.diagnostic(r.out.trim().split('\n').at(-1));
  assert.equal(r.status, 0, r.out);
});

test('the PR changes only its outputs, its item, its decisions file and its verify folder', (t) => {
  const changed = changedFiles();
  if (!changed) {
    t.diagnostic(ownPr ? 'tree mode: no base reachable' : `tree mode: PR_BODY does not name ${ITEM}`);
    for (const o of outputs) assert.ok(existsSync(join(REPO, o)), o);
    return;
  }
  const outside = changed.filter((p) => !covered(p));
  t.diagnostic(`PR mode: ${changed.length} files; outside the outputs: ${outside.join(', ') || 'none'}`);
  assert.deepEqual(outside, []);
});
