// Expect suite-and-scope: node plan/check.mjs passes at the checkout, test/docs.test.mjs passes (it holds the entry-text
// budget), and the PR changes only the files the item's outputs name, its own item file, its decisions file and
// verify/after-verdict-gaps/. On this item's own PR (PR_BODY's Item: line names it) the file list is read from git,
// against BASE_SHA or else origin/main; every other run (ci.yml's depth-1 checkout, any later clone) checks what it can
// from the tree. npm test as a whole is run by ci.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ITEM, REPO, node, read } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const head = JSON.parse(read(`plan/items/${ITEM}.md`).match(/^```json\n([\s\S]*?)\n```\n/)[1]);
const outputs = head.outputs.map((o) => o.ref);
const ALSO = [`plan/items/${ITEM}.md`, 'plan/decisions/2026-11-08-refine-round-10.md'];
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
  t.diagnostic(r.out.trim().split('\n').at(-1));
  assert.equal(r.status, 0, r.out);
});

test('test/docs.test.mjs passes, the entry-text budget among its checks', (t) => {
  const r = node(['--test', '--test-reporter=tap', join(REPO, 'test/docs.test.mjs')]);
  t.diagnostic(`${r.out.match(/^# pass \d+/m)?.[0]}, ${r.out.match(/^# fail \d+/m)?.[0]}`);
  assert.equal(r.status, 0, r.out);
});

test('the PR changes only its outputs, its item, its decisions file and its verify folder', (t) => {
  const changed = changedFiles();
  if (!changed) {
    t.diagnostic(ownPr ? 'tree mode: no base reachable' : `tree mode: PR_BODY does not name ${ITEM}`);
    assert.deepEqual([...outputs].sort(), ['docs/gates.md', 'docs/language.md', 'docs/traps.md', 'plan/README.md',
      'plugins/harness/README.md', 'scripts/release/release.mjs']);
    return;
  }
  t.diagnostic(`PR mode: ${changed.length} files: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => !outputs.includes(p) && !ALSO.includes(p) && !p.startsWith(`verify/${ITEM}/`)), []);
});
