// Expect gate-wired: the verdict workflow runs the evidence gate as a step that runs after an earlier failure, and
// the gate passes on this PR's own branch, verdict and evidence included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { REPO, node, read } from './lib.mjs';

test('verdict.yml gates job has a step running pr-gate.mjs evidence with if: !cancelled()', () => {
  const yml = read('.github/workflows/verdict.yml');
  const steps = yml.slice(yml.indexOf('\n  gates:')).split(/\n      - /).slice(1);
  const i = steps.findIndex((s) => /run: node scripts\/gates\/pr-gate\.mjs evidence\s*$/m.test(s));
  assert.ok(i >= 0, 'a step runs node scripts/gates/pr-gate.mjs evidence');
  assert.match(steps[i], /if: \$\{\{ !cancelled\(\) \}\}/);
  const first = steps.findIndex((s) => /pr-gate\.mjs stubs/.test(s));
  assert.ok(first >= 0 && first < i, 'an earlier gate step exists, so the condition matters');
});

// The PR's base: BASE_SHA when the verdict workflow runs this, else where the checkout leaves origin/main.
function prBase() {
  if (process.env.BASE_SHA) return process.env.BASE_SHA;
  return execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { cwd: REPO, encoding: 'utf8' }).trim();
}

test('the evidence gate passes on this PR at its head, against its base', (t) => {
  const base = prBase();
  const added = execFileSync('git', ['diff', '--name-only', '--diff-filter=d', base, 'HEAD', '--', 'verify/'],
    { cwd: REPO, encoding: 'utf8' }).split('\n').filter(Boolean);
  const out = node(['scripts/gates/pr-gate.mjs', 'evidence'], { cwd: REPO, env: { BASE_SHA: base, HEAD_SHA: '' } });
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /evidence gate passed/);
  t.diagnostic(`base ${base}; files under verify/ the PR adds or changes: ${added.length}; ${out.out.trim()}`);
});
