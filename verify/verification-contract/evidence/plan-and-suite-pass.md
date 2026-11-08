# plan-and-suite-pass

Commands at 25dddc9: `node plan/check.mjs`; `node --test verify/verification-contract/plan-and-suite-pass.test.mjs`;
`npm test`; `git diff --stat origin/main...25dddc9`. CI: check run `test` 128676525480 on 25dddc9.

Excerpt: plan check "8 stages, 86 items (75 live), 89 ledger rows, 17 cases / plan ok". Test 2/2: done items still
hold listed phrases and pass; no ready or doing item holds one. CI `test` (npm ci, npm test, plan check) success at
25dddc9. Local npm test: all pass but two that fail in this container for known local reasons, not this diff:
copy-not-link (fails locally on main too) and the fix-budget-rule backfill date check (needs a full-history clone).
Diff, 12 files: the eight output files, test/plan-check.test.mjs, scripts/gates/test/lib.test.mjs,
scripts/gates/test/pr-gate.test.mjs (the gate's own tests) and .github/workflows/verdict.yml (see observations). No
verify/ folder of any item.
