# full-clone-passes

Command: `node --test verify/scope-suite-own-pr/full-clone-passes.test.mjs`

Inputs: each case is a temp repo borrowing this repo's objects (or, in a depth-1 checkout, a temp bare repo the
test fetches the pinned commits into in full), with `refs/remotes/origin/main` = 97947de2a0555f447a221bad3855eeaf6d2f033c
(origin/main when verified) and a detached checkout. The suite file under test is written over
`verify/rules-said-once/suite-and-scope.test.mjs`, then `node --test` on it runs with PR_BODY, BASE_SHA, HEAD_SHA,
PR_BRANCH, PR_LABELS and NODE_TEST_CONTEXT removed. Head = 37f6dfce1a6cc749ab3d973acbb26f826a8c890c; base's file
from 9f0cbc5b1bbea14d6725dee595eaca3c3e9f4c11 (same as main at 81fd7a6).

Excerpt (5/5 pass, full clone and depth-1 clone alike):

```
head, head's file:          exit 0; tree mode: PR_BODY does not name rules-said-once, checking the scope from the tree
origin/main, head's file:   exit 0; tree mode: PR_BODY does not name rules-said-once, checking the scope from the tree
head, base's file:          exit 1; PR mode: 4 files; A plan/decisions/2026-11-08-done-verify-edits.md, A plan/items/scope-suite-own-pr.md, M plan/items/verify-regression-set.md, M verify/rules-said-once/suite-and-scope.test.mjs
origin/main, base's file:   exit 1; PR mode: 0 files;
```
