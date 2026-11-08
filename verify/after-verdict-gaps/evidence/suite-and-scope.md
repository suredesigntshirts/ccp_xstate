# suite-and-scope

At 924f822ee0f1bac754fe1e8edbaf89a3328d6a74:

- `PR_BODY='Item: after-verdict-gaps' BASE_SHA=origin/main node --test verify/after-verdict-gaps/suite-and-scope.test.mjs`:
  3/3. "plan ok"; test/docs.test.mjs passes (entry texts 223 lines, under 225). PR mode: 8 files against main 60a2760f:
  the 6 outputs, plan/items/after-verdict-gaps.md and plan/decisions/2026-11-08-refine-round-10.md (written by the
  stacked readying replan #265).
- The same without PR_BODY: 3/3 in tree mode. All of verify/after-verdict-gaps/ in a depth-1 clone of the head: 18/18.
- npm test: the PR's ci `test` job 128761550723 at 924f822ee0f1bac754fe1e8edbaf89a3328d6a74: 2156 tests, 2144 pass, 0 fail, 12 skipped; plan ok. A local
  npm test in this container was not counted: the checkout had no node_modules and the run hit the 20-minute limit.
