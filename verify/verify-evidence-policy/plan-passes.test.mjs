// Expect plan-passes: the plan check passes at the head, and the PR changes only the item's outputs, its own plan
// item and verify/verify-evidence-policy/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { REPO, node } from './lib.mjs';

test('node plan/check.mjs passes at the head', (t) => {
  const out = node(['plan/check.mjs'], { cwd: REPO });
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /plan ok/);
  t.diagnostic(out.out.trim().replace(/\n/g, ' / '));
});

// The outputs the item names, written out here from its head, plus its plan item.
const ALLOWED = ['scripts/gates/lib.mjs', 'scripts/gates/pr-gate.mjs', '.github/workflows/verdict.yml', 'plan/README.md',
  'docs/gates.md', 'docs/language.md', 'scripts/gates/test/lib.test.mjs', 'scripts/gates/test/pr-gate.test.mjs',
  'plan/items/verify-evidence-policy.md'];

test('the PR changes only its outputs, its plan item and its own verify/ folder', (t) => {
  const base = process.env.BASE_SHA
    ?? execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: REPO, encoding: 'utf8' }).trim();
  const mb = execFileSync('git', ['merge-base', base, 'HEAD'], { cwd: REPO, encoding: 'utf8' }).trim();
  const files = execFileSync('git', ['diff', '--name-only', mb, 'HEAD'], { cwd: REPO, encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const stray = files.filter((f) => !ALLOWED.includes(f) && !f.startsWith('verify/verify-evidence-policy/'));
  assert.deepEqual(stray, []);
  assert.deepEqual(files.filter((f) => f.startsWith('verify/') && !f.startsWith('verify/verify-evidence-policy/')), []);
  t.diagnostic(`${files.length} files: ${files.join(', ')}`);
});
