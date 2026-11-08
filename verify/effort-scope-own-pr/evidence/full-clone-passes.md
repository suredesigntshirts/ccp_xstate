# full-clone-passes

Command: `node --test verify/effort-scope-own-pr/full-clone-passes.test.mjs`

Inputs: each case is a temp repo borrowing this repo's objects (in a depth-1 checkout, a temp bare repo the test
fetches the pinned commits into in full), with `refs/remotes/origin/main` = 6a43f408e2b6049ec03b9bd488fd99866f709baa
(origin/main when verified) and a checkout of the head 0baec6327126ece07b8f5dc7a99069cb6e3c89ba. The temp branch
`esop-temp` adds one commit with `esop-stray-outside-outputs.txt`. The base's suite file is the one at 6a43f408.
`node --test` on `verify/plan-reader-effort/plan-and-suite-pass.test.mjs` runs with PR_BODY, BASE_SHA, HEAD_SHA,
PR_BRANCH, PR_LABELS and NODE_TEST_CONTEXT removed.

Excerpt (5/5 pass, in a full clone and in a depth-1 clone alike):

```
# exit 0; tree mode: PR_BODY does not name plan-reader-effort; every output exists in the tree
# exit 0; tree mode: PR_BODY does not name plan-reader-effort; every output exists in the tree
# exit 1; PR mode: 4 files: docs/traps.md, esop-stray-outside-outputs.txt, plan/items/effort-scope-own-pr.md, verify/plan-reader-effort/plan-and-suite-pass.test.mjs
```

Lines in order: the head with its own file; the temp branch with the head's file; the temp branch with the base's file.
