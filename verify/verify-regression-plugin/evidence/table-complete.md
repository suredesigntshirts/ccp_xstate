# table-complete

Command: `node --test verify/verify-regression-plugin/table.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf (base 2178cc6c0e9b86456c7dc35fd352b16952356bf1, the merge-base with main).

Excerpt: 3/3 pass. `# 50 rows: 17 moved, 16 split, 17 left`. The rows equal the 50 `*.test.mjs` files `git ls-tree -r 2178cc6c0e9b86456c7dc35fd352b16952356bf1 -- verify/<suite>` lists for the 19 suites; every verdict is moved, split or left with a reason, every split names `moved:` and `left:`; all 16 destinations exist under test/regression/{plugin,inspector,journal,engine}/. Run against a worktree of the base (`VRP_REPO=<worktree>`) the file fails 3 of 3.

Inputs: BASE and VERIFIED are pinned in lib.mjs; in a depth-1 checkout the test fetches them by sha.
