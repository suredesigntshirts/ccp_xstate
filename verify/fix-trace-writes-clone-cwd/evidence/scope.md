# scope

Command: `node --test verify/fix-trace-writes-clone-cwd/scope.test.mjs`, which runs
`git diff --name-only 8244eae5c7b411b175f05af25f2144555e7abfb0 6472dc6bd76d43db4c6ace82f857f15403020abc` and `git diff -U0` on each of the four plan-copy helpers (each commit fetched at
depth 1 when missing).

Excerpt:

    # plan/items/fix-trace-writes-clone-cwd.md, scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs,
    #   test/plan-check.test.mjs, verify/fix-budget-rule/lib.mjs, verify/verification-contract/lib.mjs,
    #   verify/verification-contract/tests-bite.test.mjs
    # test/plan-check.test.mjs: -1 +9
    ok - the PR changes only the item files and the four plan-copy helpers
    ok - the four helpers only make module files in their temp copies

The helpers remove only import lines (re-added with readdirSync or makeLiveModules) and add the live-module walk
over plan/items and the empty files it writes; no assert, test or skip line is added.
