// Expect suite-and-scope: node plan/check.mjs passes at the checkout, and the PR changes only the files the item's
// outputs name, its own item file, its decisions file and verify/verifier-reader-gaps/. On this item's own PR (PR_BODY's
// Item: line names it) the file list is read from git, against BASE_SHA or else origin/main; every other run (ci.yml's
// depth-1 checkout, any later clone) checks what it can from the tree. npm test itself is run by ci.
// It also checks the one frozen-suite change the outputs name still bites: verify/fresh-reader-gaps's step-2 checks,
// run against copies of plan/README.md whose step 2 drops or reverses each point, fail, and fail only there.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ITEM, REPO, node, read, splitItem } from './lib.mjs';
import { namedItem } from '../../scripts/gates/lib.mjs';

const { head } = splitItem(read(`plan/items/${ITEM}.md`));
const outputs = head.outputs.flatMap((o) => o.ref.split(/,\s*/));
const ALSO = [`plan/items/${ITEM}.md`, 'plan/decisions/2026-11-08-refine-round-7.md'];
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

test('the PR changes only its outputs, its item, its decisions file and its verify folder', (t) => {
  const changed = changedFiles();
  if (!changed) {
    t.diagnostic(ownPr ? 'tree mode: no base reachable' : `tree mode: PR_BODY does not name ${ITEM}`);
    assert.deepEqual(outputs.sort(), ['docs/gates.md', 'plan/README.md',
      'verify/fresh-reader-gaps/fresh-reader-path.test.mjs']);
    return;
  }
  t.diagnostic(`PR mode: ${changed.length} files: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => !outputs.includes(p) && !ALSO.includes(p) && !p.startsWith(`verify/${ITEM}/`)), []);
});

const SUITE = join(REPO, 'verify/fresh-reader-gaps/fresh-reader-path.test.mjs');
const STEP2 = /^2\. \*\*Build PR\.\*\*[\s\S]*?(?=\n3\. \*\*)/m;
const runSuite = (t, readme) => {
  const dir = mkdtempSync(join(tmpdir(), 'vrg-frg-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const f of ['CLAUDE.md', 'docs/gates.md']) {
    mkdirSync(join(dir, f, '..'), { recursive: true });
    writeFileSync(join(dir, f), read(f));
  }
  mkdirSync(join(dir, 'plan'));
  writeFileSync(join(dir, 'plan/README.md'), readme);
  return node(['--test', SUITE], { env: { FRG_REPO: dir } });
};

test('fresh-reader-gaps step-2 checks pass on the head README', (t) => {
  const r = runSuite(t, read('plan/README.md'));
  assert.equal(r.status, 0, r.out);
});

const MUTANTS = {
  'done_on not set by the first commit': (s) => s.replace(/ \(and `done_on` to that day if the item names a `module`\)/, ''),
  'done not set by the first commit': (s) => s.replace('sets status `done`', 'leaves the status'),
  'the builder writes under verify/<id>/': (s) => s.replace('writes nothing under `verify/<id>/`', 'writes its tests under `verify/<id>/`'),
  'no verifier asked for': (s) => s.replace(' and asks its starter for a verifier', ''),
  'a sentence break before the verifier': (s) => s.replace('`verify/<id>/` and asks its starter for a verifier', '`verify/<id>/`. The starter picks a verifier'),
};
for (const [name, mutate] of Object.entries(MUTANTS)) {
  test(`fresh-reader-gaps step-2 checks fail when step 2 says: ${name}`, (t) => {
    const readme = read('plan/README.md');
    const step2 = readme.match(STEP2)[0];
    const mutated = readme.replace(step2, mutate(step2));
    assert.notEqual(mutated, readme, 'the mutation applied');
    const r = runSuite(t, mutated);
    const failed = [...r.out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
    t.diagnostic(`failed: ${failed.join('; ')}`);
    assert.equal(r.status, 1, r.out);
    assert.ok(failed.length > 0 && failed.every((n) => /step 2 says/.test(n)), failed.join('; '));
  });
}
