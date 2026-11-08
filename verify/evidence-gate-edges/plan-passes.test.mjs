// Expect plan-passes: the plan check passes at the head, and the PR changes only the files the outputs name, its own
// plan item and verify/evidence-gate-edges/, no other item's verify/ folder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, read } from './lib.mjs';

test('node plan/check.mjs passes at the head', (t) => {
  const out = node(['plan/check.mjs'], { cwd: REPO });
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /plan ok/);
  t.diagnostic(out.out.trim().replace(/\n/g, ' / '));
});

const ALLOWED = ['scripts/gates/lib.mjs', 'scripts/gates/pr-gate.mjs', 'docs/gates.md', 'plan/README.md',
  'docs/language.md', 'scripts/gates/test/lib.test.mjs', 'scripts/gates/test/pr-gate.test.mjs',
  'plan/items/evidence-gate-edges.md'];

// The diff is read only where this PR is the one under test, as the verdict job sets PR_BRANCH and BASE_SHA with full
// history. Elsewhere (ci.yml's depth-1 checkout, a later PR, main) the test checks what holds at any head.
const OWN_PR = process.env.PR_BRANCH === 'build/evidence-gate-edges' && process.env.BASE_SHA;

test('the PR changes only its outputs, its plan item and its own verify/ folder', (t) => {
  if (OWN_PR) {
    const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
    const files = git('diff', '--name-only', git('merge-base', process.env.BASE_SHA, 'HEAD'), 'HEAD').split('\n').filter(Boolean);
    const stray = files.filter((f) => !ALLOWED.includes(f) && !f.startsWith('verify/evidence-gate-edges/'));
    assert.deepEqual(stray, []);
    t.diagnostic(`${files.length} files: ${files.join(', ')}`);
    return;
  }
  for (const f of ALLOWED) assert.ok(existsSync(join(REPO, f)), `${f} exists`);
  const head = JSON.parse(read('plan/items/evidence-gate-edges.md').match(/^```json\n([\s\S]*?)\n```/)[1]);
  const outputs = head.outputs.flatMap((o) => o.ref.split(/,\s*/));
  assert.deepEqual([...outputs].sort(), ALLOWED.filter((f) => !f.startsWith('plan/items/')).sort());
  t.diagnostic('no PR under test here; the outputs list equals the allowed files and they exist');
});
