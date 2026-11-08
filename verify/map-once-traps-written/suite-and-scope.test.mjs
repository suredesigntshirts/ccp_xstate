// Expect suite-and-scope: node plan/check.mjs passes, the verdict workflow sets no PR_BRANCH, and the PR changes only
// the files the item's outputs name and its own plan item. The PR is read as the diff from its base at verification
// (main after #217) to the verified head, both pinned here, so the check holds after the PR merges. When either commit
// is missing (ci.yml's depth-1 checkout) the test fetches it at depth 1 into a temp repo; offline it checks the outputs from the tree.
// npm test itself is run by ci; this file is part of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node, read } from './lib.mjs';

const ITEM = 'map-once-traps-written';
const BASE = '43b4f45a7b1f1512ec31c671a9ad4901b60c0628';
const VERIFIED = 'd9e142f7dc7235d4c964a5c364bdf942afc76afb';
const OUTPUTS = ['CLAUDE.md', 'docs/layout.md', 'docs/traps.md', 'test/docs.test.mjs', '.github/workflows/verdict.yml'];
/**
 * A git dir holding every sha in `shas`: `root` when it has them, else a temp bare repo they are fetched into at
 * depth 1, removed when the process exits; null when neither can give them. The checkout itself is never fetched
 * into: suites run in parallel, and fetches into one shallow repo collide on its .git/shallow.lock.
 */
function pinnedRepo(root, shas) {
  const run = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 300_000 }).trim();
  const holds = (dir) => shas.every((s) => { try { run(dir, 'cat-file', '-e', `${s}^{commit}`); return true; } catch { return false; } });
  if (holds(root)) return root;
  const dir = mkdtempSync(join(tmpdir(), 'pinned-'));
  process.on('exit', () => rmSync(dir, { recursive: true, force: true }));
  // actions/checkout keeps its credentials in the checkout's own config; the temp repo borrows them for this fetch.
  const auth = (() => { try { return run(root, 'config', '--get-regexp', '^http\\..*extraheader$').split('\n'); } catch { return []; } })()
    .filter(Boolean).flatMap((l) => { const i = l.indexOf(' '); return ['-c', `${l.slice(0, i)}=${l.slice(i + 1)}`]; });
  try {
    run(root, 'init', '-q', '--bare', dir);
    run(dir, ...auth, 'fetch', '-q', '--depth=1', run(root, 'remote', 'get-url', 'origin'), ...shas);
  } catch { return null; }
  return holds(dir) ? dir : null;
}

function changed() {
  const dir = pinnedRepo(REPO, [BASE, VERIFIED]);
  if (!dir) return null;
  return execFileSync('git', ['diff', '--name-only', '--no-renames', BASE, VERIFIED], { cwd: dir, encoding: 'utf8' })
    .split('\n').filter(Boolean);
}

test('node plan/check.mjs passes', (t) => {
  const r = node([join(REPO, 'plan/check.mjs')], { cwd: REPO });
  t.diagnostic(r.out.trim().split('\n').slice(-2).join(' / '));
  assert.equal(r.status, 0, r.out);
});

test('the verdict workflow sets no PR_BRANCH', () => {
  const yml = read('.github/workflows/verdict.yml');
  assert.doesNotMatch(yml, /PR_BRANCH/);
  for (const v of ['BASE_SHA', 'HEAD_SHA', 'PR_BODY', 'PR_LABELS']) assert.match(yml, new RegExp(`${v}:`), `${v} kept`);
});

test("the item's outputs are what its head names", () => {
  const head = JSON.parse(read(`plan/items/${ITEM}.md`).match(/```json\n([\s\S]*?)\n```/)[1]);
  assert.deepEqual(head.outputs.map((o) => o.ref).sort(), [...OUTPUTS].sort());
});

test('the PR changes only its outputs and its own plan item', (t) => {
  const files = changed();
  if (!files) {
    t.diagnostic('base or verified head unreachable: checking the outputs from the tree');
    for (const p of OUTPUTS) assert.ok(existsSync(join(REPO, p)), p);
    return;
  }
  t.diagnostic(`${BASE.slice(0, 7)}..${VERIFIED.slice(0, 7)}: ${files.join(', ')}`);
  const allowed = new Set([...OUTPUTS, `plan/items/${ITEM}.md`]);
  assert.deepEqual(files.filter((p) => !allowed.has(p)), []);
  assert.ok(files.includes('docs/traps.md') && files.includes('.github/workflows/verdict.yml'), files.join(', '));
});
