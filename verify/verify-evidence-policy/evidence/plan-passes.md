# plan-passes

Command: `node --test verify/verify-evidence-policy/plan-passes.test.mjs` at 7f52c6f6e724ab8af45cddf35cbde0847016f05e (runs `node plan/check.mjs`, then
`git diff --name-only <merge-base> HEAD`, base from BASE_SHA or origin/main).

Excerpt (2/2 pass): "8 stages, 89 items (78 live), 89 ledger rows, 17 cases / plan ok". The diff, 9 files before
the verdict: .github/workflows/verdict.yml, docs/gates.md, docs/language.md, plan/README.md,
plan/items/verify-evidence-policy.md, scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs,
scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs; then only verify/verify-evidence-policy/.
Every one is a named output or the item's own file; no other item's verify/ folder.

The diff is read only when PR_BRANCH=build/verify-evidence-policy and BASE_SHA are set, as the verdict job sets
them (by hand: `BASE_SHA=3946736 PR_BRANCH=build/verify-evidence-policy node --test ...`, 23 files, 2/2). Elsewhere
(ci.yml's depth-1 checkout, a later PR, main) it checks that the item's outputs list equals the allowed files and
each exists: 2/2 in a `git clone --depth 1` with no origin/main.
