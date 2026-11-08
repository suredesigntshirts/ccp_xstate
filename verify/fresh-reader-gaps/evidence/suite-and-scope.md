# suite-and-scope

- `node --test verify/fresh-reader-gaps/suite-and-scope.test.mjs` at build head `7d35231e`: 3/3 pass. With
  `PR_BODY="Item: fresh-reader-gaps" BASE_SHA=origin/main` (PR mode): 6 files changed against main: CLAUDE.md,
  docs/gates.md, plan/README.md, plan/decisions/2026-11-08-refine-round-6.md, plan/items/fresh-reader-gaps.md,
  test/docs.test.mjs. Four are outputs; the other two are the item and its decisions file from readying replan #255,
  which this build is stacked on. Without PR_BODY (tree mode, as ci.yml runs it) it checks the outputs list.
- `node plan/check.mjs`: plan ok.
- npm test on GitHub, ci test job 128741173622 at `7d35231e495c41b2dae36edb936fdf8494648814`: tests 2082, pass 2070,
  fail 0, skipped 12; then plan ok.
- npm test locally in the clean clone (origin removed) with this folder added: 2090 tests, 2071 pass, 7 fail. All 7
  need a remote or history the clone lacks (six "the pinned commits are reachable" in other items' verify suites, and
  the fix-budget-rule done_on backfill); none is in this folder, and none fails in ci.
