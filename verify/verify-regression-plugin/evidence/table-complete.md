# table-complete

Command: `node --test verify/verify-regression-plugin/table.test.mjs` at head db2ba7ec736ea81865f13c8833118f992b8dba1f (base e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4, the merge-base with main).

Excerpt: 3/3 pass. `# 50 rows: 17 moved, 16 split, 17 left`. The rows equal the 50 `*.test.mjs` files `git ls-tree -r e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4 -- verify/<suite>` lists for the 19 suites; every verdict is moved, split or left with a reason, every split names `moved:` and `left:`; all 16 destinations exist under test/regression/{plugin,inspector,journal,engine}/. Run against a worktree of the base (`VRP_REPO=<worktree>`) the file fails 3 of 3.

Inputs: BASE and VERIFIED are pinned in lib.mjs; in a depth-1 checkout the test fetches them by sha.
