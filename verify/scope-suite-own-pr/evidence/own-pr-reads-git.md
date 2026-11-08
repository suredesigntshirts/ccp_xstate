# own-pr-reads-git

Command: `node --test verify/scope-suite-own-pr/own-pr-reads-git.test.mjs`

Inputs: temp repo detached at #202's last commit 1af034ec917ba56eb2130ac16ed304b8315c828f (second parent of merge
81fd7a6), the head's suite file (37f6dfce) written over it uncommitted. BASE_SHA = 66e47a6a5417484a3da9947148fcb25de73e6738
(first parent of 81fd7a6). Runs: PR_BODY "...Item: rules-said-once"; then after committing `ssop-stray-outside-outputs.txt`
the same; then PR_BODY "Item: another-item" with the same BASE_SHA at the stray commit.

Excerpt (3/3 subtests pass, full clone and depth-1 clone alike):

```
Item: rules-said-once:          exit 0; PR mode: 30 files; M CLAUDE.md, M docs/gates.md, ...
+ stray commit:                 exit 1; PR mode: 31 files; ... A ssop-stray-outside-outputs.txt ...
                                assertion diff: +     p: 'ssop-stray-outside-outputs.txt',
Item: another-item (at stray):  exit 0; tree mode: PR_BODY does not name rules-said-once, checking the scope from the tree
```
