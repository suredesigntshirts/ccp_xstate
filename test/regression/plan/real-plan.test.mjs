// Expect: verdict-cutoff-at-verified-sha/plan-passes, evidence-gate-edges/plan-passes, verify-evidence-policy/plan-passes, verification-contract/plan-and-suite-pass, plan-reader-effort/plan-and-suite-pass, rules-said-once/suite-and-scope, verifier-reader-gaps/suite-and-scope, map-once-traps-written/suite-and-scope, fresh-reader-gaps/suite-and-scope, rule-text-tests/suite-and-scope
// The plan check passes on the repo's own plan.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

test('node plan/check.mjs passes on the repo\'s plan', (t) => {
  const r = spawnSync(process.execPath, [join(REPO, 'plan/check.mjs')], { cwd: REPO, encoding: 'utf8' });
  t.diagnostic(r.stdout.trim().replace(/\n/g, ' / '));
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /plan ok/);
});
