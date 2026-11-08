# plan-passes

Command: `node --test verify/evidence-gate-edges/plan-passes.test.mjs` at 10dad10eaa0cb475756403011bb41923694d092c, once plain and once with
`PR_BRANCH=build/evidence-gate-edges BASE_SHA=origin/main` as the verdict job sets them.

Excerpt: 2 tests, 2 pass in both modes.

- "8 stages, 100 items (89 live), 90 ledger rows, 17 cases / plan ok".
- PR mode, git diff --name-only from the merge-base: 8 files, docs/gates.md, docs/language.md, plan/README.md,
  plan/items/evidence-gate-edges.md, scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/lib.test.mjs,
  scripts/gates/test/pr-gate.test.mjs; plus this folder once the verdict lands. No other item's verify/ folder.
- Plain mode (ci.yml depth 1): the outputs list equals the allowed files, all present.
