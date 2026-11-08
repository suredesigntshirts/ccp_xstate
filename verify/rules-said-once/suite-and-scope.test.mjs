// Expect suite-and-scope: node plan/check.mjs passes at the head, and the PR changes only the files the item's outputs
// name, with only the named verify/ changes. When the base is reachable (BASE_SHA, as the verdict job sets it, or
// origin/main) the PR's file list is read from git; ci.yml's depth-1 checkout has neither, so there the test checks
// the same scope from the tree: the three deleted files are gone and the two trimmed tests are gone from their files.
// npm test itself is run by ci; this file is part of it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, read, splitItem } from './lib.mjs';

const ITEM = 'rules-said-once';
const outputs = splitItem(read(`plan/items/${ITEM}.md`)).head.outputs.flatMap((o) => o.ref.split(/,\s*/));
const DELETED = ['verify/repo-skeleton/claude-md.test.mjs', 'verify/verification-contract/rules-written.test.mjs',
  'verify/fix-budget-rule/rule-written.test.mjs'];
const TRIMMED = ['verify/harness-glossary/notes.test.mjs', 'verify/verify-evidence-policy/policy-written.test.mjs'];
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

const CALLER = 'scripts/gates/pr-gate.mjs';
let baseUsed = null;
function changedFiles() {
  for (const base of [process.env.BASE_SHA, 'origin/main'].filter(Boolean)) {
    try { baseUsed = base; return git('diff', '--name-status', '--no-renames', `${git('merge-base', base, 'HEAD')}`, 'HEAD').split('\n').filter(Boolean)
      .map((l) => { const [s, p] = l.split('\t'); return { s, p }; }); } catch {}
  }
  return null;
}

test('node plan/check.mjs passes', (t) => {
  const r = node([join(REPO, 'plan/check.mjs')], { cwd: REPO });
  t.diagnostic(r.out.trim().split('\n').slice(-2).join(' / '));
  assert.equal(r.status, 0, r.out);
});

test('the PR changes only the files its outputs name, and only the named verify/ changes', (t) => {
  const changed = changedFiles();
  if (changed) {
    const allowed = (p) => outputs.includes(p) || p.startsWith(`verify/${ITEM}/`) || p === `plan/items/${ITEM}.md`
      || p === 'plan/decisions/2026-11-08-refine-round-1.md' || p === 'plan/ledger/process.md';
    const stray = changed.filter(({ p }) => !allowed(p) && p !== CALLER);
    // scripts/gates/pr-gate.mjs is namedItem's caller, which the item's inputs name: it may change only the call and
    // the header line listing the environment it reads.
    if (changed.some(({ p }) => p === CALLER)) {
      const edits = git('diff', '-U0', git('merge-base', baseUsed, 'HEAD'), 'HEAD', '--', CALLER).split('\n')
        .filter((l) => /^[-+](?![-+])/.test(l));
      t.diagnostic(`${CALLER}: ${edits.join(' | ')}`);
      assert.ok(edits.length <= 4 && edits.every((l) => /namedItem\(|^[-+]\/\/ Reads BASE_SHA/.test(l)), edits.join('\n'));
    }
    t.diagnostic(`PR mode: ${changed.length} files; ${changed.map(({ s, p }) => `${s} ${p}`).join(', ')}`);
    assert.deepEqual(stray, []);
    const verify = changed.filter(({ p }) => p.startsWith('verify/') && !p.startsWith(`verify/${ITEM}/`));
    assert.deepEqual(verify.map(({ s, p }) => `${s} ${p}`).sort(),
      [...DELETED.map((p) => `D ${p}`), ...TRIMMED.map((p) => `M ${p}`)].sort());
  } else t.diagnostic('depth-1 mode: no base reachable, checking the scope from the tree');
  for (const p of DELETED) assert.ok(!existsSync(join(REPO, p)), `${p} is deleted`);
  assert.doesNotMatch(read(TRIMMED[1]), /plan\/README\.md/, "the plan/README.md test left policy-written.test.mjs");
  assert.match(read(TRIMMED[1]), /docs\/gates\.md/, "the docs/gates.md test stays in policy-written.test.mjs");
});
