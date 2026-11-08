# scope

Command: `node --test verify/scope-suite-own-pr/scope.test.mjs` (`git diff --name-only --no-renames`).

Inputs: build head 37f6dfce1a6cc749ab3d973acbb26f826a8c890c; the readying replan head it is stacked on (#221)
9f0cbc5b1bbea14d6725dee595eaca3c3e9f4c11; the PR's base on GitHub 81fd7a6d7ba27e7074bdec8b7136624d39aca85f.

Excerpt (2/2 pass):

```
9f0cbc5b..37f6dfce: plan/items/scope-suite-own-pr.md, verify/rules-said-once/suite-and-scope.test.mjs
81fd7a6d..37f6dfce: plan/decisions/2026-11-08-done-verify-edits.md, plan/items/scope-suite-own-pr.md, plan/items/verify-regression-set.md, verify/rules-said-once/suite-and-scope.test.mjs
verify/rules-said-once/verdict.json blob identical at 81fd7a6 and 37f6dfce; verify/ diff = the suite file only
```
