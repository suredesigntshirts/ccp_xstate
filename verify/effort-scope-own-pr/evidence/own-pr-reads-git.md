# own-pr-reads-git

Command: `node --test verify/effort-scope-own-pr/own-pr-reads-git.test.mjs`

Inputs: a temp repo at #212's last commit 6339fa58a43d5e538223d529d8a94b5631ce92f9 with the head's (0baec632) suite
file committed over `verify/plan-reader-effort/plan-and-suite-pass.test.mjs`; BASE_SHA =
e12655529525141a85168ce9ce2c969576c5fd65 (#212's base, first parent of its merge a4e3a59d). Run 1: PR_BODY with the line
`Item: plan-reader-effort`. Run 2: the same after one more commit adding `esop-stray-outside-outputs.txt`. Run 3:
PR_BODY `Item: another-item`.

Excerpt (5/5 pass, full clone and depth-1 clone alike; file lists cut):

```
# exit 0; PR mode: 31 files: docs/gates.md, docs/language.md, plan/README.md, plan/check.mjs, plan/item.schema.json, plan/items/plan-reader-effort.md, scripts/gates/lib.mjs, scripts/gates/test/lib.tes
# exit 1; PR mode: 32 files: docs/gates.md, docs/language.md, esop-stray-outside-outputs.txt, plan/README.md, plan/check.mjs, plan/item.schema.json, plan/items/plan-reader-effort.md, scripts/gates/lib
# failure lines naming it: 2; +   'esop-stray-outside-outputs.txt'
# exit 0; tree mode: PR_BODY does not name plan-reader-effort; every output exists in the tree
```
