# scope

Command: `node --test verify/effort-scope-own-pr/scope.test.mjs`

Inputs: `git diff --name-only --no-renames 6a43f408 0baec632` (the PR's GitHub base, main after readying replan #233
merged, to the head), and the blob of `verify/plan-reader-effort/verdict.json` at both.

Excerpt (3/3 pass):

```
# 6a43f408..0baec632: docs/traps.md, plan/items/effort-scope-own-pr.md, verify/plan-reader-effort/plan-and-suite-pass.test.mjs
# verdict and evidence changes: 0
```
