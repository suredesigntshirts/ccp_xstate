# plan-passes

Command: `node --test verify/verify-evidence-policy/plan-passes.test.mjs` at 7f52c6f6e724ab8af45cddf35cbde0847016f05e (runs `node plan/check.mjs`, then
`git diff --name-only <merge-base> HEAD`, base from BASE_SHA or origin/main).

Excerpt (2/2 pass): "8 stages, 89 items (78 live), 89 ledger rows, 17 cases / plan ok". The diff, 9 files before
the verdict: .github/workflows/verdict.yml, docs/gates.md, docs/language.md, plan/README.md,
plan/items/verify-evidence-policy.md, scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs,
scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs; then only verify/verify-evidence-policy/.
Every one is a named output or the item's own file; no other item's verify/ folder.
