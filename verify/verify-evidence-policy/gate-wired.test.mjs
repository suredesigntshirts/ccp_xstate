// Expect gate-wired: the verdict workflow runs the evidence gate as a step that runs after an earlier failure, and
// the gate passes this PR's own verify/ folder, verdict and evidence included.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, gateRepo, read } from './lib.mjs';

test('verdict.yml gates job has a step running pr-gate.mjs evidence with if: !cancelled()', () => {
  const yml = read('.github/workflows/verdict.yml');
  const steps = yml.slice(yml.indexOf('\n  gates:')).split(/\n      - /).slice(1);
  const i = steps.findIndex((s) => /run: node scripts\/gates\/pr-gate\.mjs evidence\s*$/m.test(s));
  assert.ok(i >= 0, 'a step runs node scripts/gates/pr-gate.mjs evidence');
  assert.match(steps[i], /if: \$\{\{ !cancelled\(\) \}\}/);
  const first = steps.findIndex((s) => /pr-gate\.mjs stubs/.test(s));
  assert.ok(first >= 0 && first < i, 'an earlier gate step exists, so the condition matters');
});

// The PR's own files under verify/, committed onto a base without them in a temp repo: needs no history, so it holds
// in a shallow CI checkout and on any later head.
test('the evidence gate passes this item\'s own verify/ folder, verdict and evidence included', (t) => {
  const own = 'verify/verify-evidence-policy';
  const files = readdirSync(join(REPO, own), { recursive: true, withFileTypes: true }).filter((d) => d.isFile())
    .map((d) => join(d.parentPath ?? d.path, d.name).slice(REPO.length + 1));
  assert.ok(files.includes(`${own}/verdict.json`), 'the verdict is in the folder');
  const r = gateRepo(t);
  r.branch('build/verify-evidence-policy');
  r.commit(Object.fromEntries(files.map((f) => [f, readFileSync(join(REPO, f))])), 'the verifier folder');
  const out = r.evidence();
  assert.equal(out.status, 0, out.out);
  assert.match(out.out, /evidence gate passed/);
  t.diagnostic(`${files.length} files under ${own}/: ${out.out.trim()}`);
});
