// Expect plan-passes: the plan check passes at the head, and the PR changes only the item's outputs, its own plan
// item and verify/verdict-cutoff-at-verified-sha/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, read } from './lib.mjs';

const ITEM = 'verdict-cutoff-at-verified-sha';

test('node plan/check.mjs passes at the head', (t) => {
  const out = node(['plan/check.mjs'], { cwd: REPO });
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /plan ok/);
  t.diagnostic(out.out.trim().replace(/\n/g, ' / '));
});

const ALLOWED = ['scripts/gates/lib.mjs', 'scripts/gates/pr-gate.mjs', 'docs/gates.md', 'docs/language.md',
  'scripts/gates/test/lib.test.mjs', 'scripts/gates/test/pr-gate.test.mjs', `plan/items/${ITEM}.md`];

// The diff is read only where this PR is the one under test: the verdict workflow sets PR_BODY and BASE_SHA and
// fetches full history. Elsewhere (ci.yml's depth-1 checkout, a later PR, main) the PR is gone, and the test checks
// what holds at any head: the files the item names exist, and its outputs list exactly the allowed code files.
const OWN_PR = new RegExp(`^Item:\\s*${ITEM}\\s*$`, 'm').test(process.env.PR_BODY ?? '') && process.env.BASE_SHA;

test('the PR changes only its outputs, its plan item and its own verify/ folder', (t) => {
  if (OWN_PR) {
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const files = git('diff', '--name-only', git('merge-base', process.env.BASE_SHA, 'HEAD'), 'HEAD').split('\n').filter(Boolean);
    const stray = files.filter((f) => !ALLOWED.includes(f) && !f.startsWith(`verify/${ITEM}/`));
    assert.deepEqual(stray, []);
    t.diagnostic(`${files.length} files: ${files.join(', ')}`);
    return;
  }
  for (const f of ALLOWED) assert.ok(existsSync(join(REPO, f)), `${f} exists`);
  const head = JSON.parse(read(`plan/items/${ITEM}.md`).match(/^```json\n([\s\S]*?)\n```/)[1]);
  const outputs = head.outputs.flatMap((o) => o.ref.split(/,\s*/));
  assert.deepEqual([...outputs].sort(), ALLOWED.filter((f) => !f.startsWith('plan/items/')).sort());
  t.diagnostic('no PR under test here; the outputs list and the files exist');
});
