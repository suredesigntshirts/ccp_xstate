# scope

Command: `node --test verify/fix-trace-writes-clone-cwd/scope.test.mjs`, which runs
`git diff --name-only e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4 82c86117f65646132646540b8006bed66aa2b2a4` (each commit fetched at depth 1 when missing), leaving out this verifier's own
folder. e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4 is main e9ed7db (#223), as merged into the branch and the PR's base on GitHub.

Excerpt:

    # scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs
    ok - the PR changes only the script, its test file and the item file

The item file and the four plan-copy helpers are as main has them at 82c86117f65646132646540b8006bed66aa2b2a4.
