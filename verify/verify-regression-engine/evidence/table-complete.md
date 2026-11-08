# table-complete

Command: `node --test verify/verify-regression-engine/table.test.mjs` at ad3d018 (base 3862da5, fetched at depth 1 when the checkout lacks it).
Inputs: `git ls-tree -r 3862da5 verify/<suite>` for the 26 suites, filtered to `*.test.mjs`; the `## Regression table` of plan/items/verify-regression-engine.md at the head.

Excerpt: 3/3 pass. 61 rows (30 moved, 17 split, 14 left) equal the 61 base test files, no duplicates; every split reason names a moved and a left half; all 33 distinct destinations exist under test/regression/{engine,run,marks,plan,inspector}/. Against the base tree (VRE_REPO=<base worktree>): 2 of 3 fail.
