// Expect suite-and-scope: node plan/check.mjs passes at the checkout, test/docs.test.mjs passes (it holds the entry-text
// budget), and the PR changes only the files the item's outputs name, its own item file, its decisions file and
// verify/item-writer-gaps/. On this item's own PR (PR_BODY's Item: line names it) the file list is read from git,
// against BASE_SHA or else origin/main; every other run (ci.yml's depth-1 checkout, any later clone) checks what it can
// from the tree. npm test as a whole is run by ci.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { ITEM, REPO, flat, node, read, section, splitItem } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const { head } = splitItem(read(`plan/items/${ITEM}.md`));
const outputs = head.outputs.map((o) => o.ref);
const ALSO = [`plan/items/${ITEM}.md`, 'plan/decisions/2026-11-08-refine-round-9.md'];
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
    assert.deepEqual([...outputs].sort(), ['CLAUDE.md', 'plan/README.md', 'plan/check.mjs', 'test/plan-check.test.mjs']);
    return;
  }
  t.diagnostic(`PR mode: ${changed.length} files: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => !outputs.includes(p) && !ALSO.includes(p) && !p.startsWith(`verify/${ITEM}/`)), []);
});

test('CLAUDE.md names the four steps as leading to done, and the README field table has no reader_effort row', (t) => {
  const working = flat(section(read('CLAUDE.md'), 'Working an item'));
  t.diagnostic(working.split('. ')[1]);
  assert.match(working, /four steps/);
  assert.match(working, /\bto done\b/);
  assert.doesNotMatch(working, /from ready/);
  const rows = section(read('plan/README.md'), 'How an item is written').split('\n').filter((l) => l.startsWith('| `'));
  assert.ok(rows.length > 5, rows.join('\n'));
  assert.ok(!rows.some((r) => r.includes('reader_effort')), rows.join('\n'));
});
