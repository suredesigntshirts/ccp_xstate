# item-line-names

Command (at the build head 45d60e2, repeatable at any checkout): `node --test verify/rules-said-once/item-line-names.test.mjs`.
Each case copies plan/, scripts/ and package.json into a temp git repo (base commit on main), commits a PR branch, and runs `node scripts/gates/pr-gate.mjs verdict` with BASE_SHA=<base>, PR_BRANCH, PR_BODY and PR_LABELS set. Existing items used: test-fixture-edges (draft) and fix-budget-rule (only as a branch name); a toy item rso-toy with one world line and a hand-written verdict from another session shows a complete verdict passing under a misleading branch.

```
ok 1 - a plan-only PR on replan/<existing id> with no Item line passes the verdict gate
# verdict gate passed
ok 2 - a PR on build/<existing id> that changes a file outside plan/ with no Item line is refused for the missing line
# verdict gate failed:\\n  this PR changes files outside plan/ but names no item (add an "Item: <id>" line to its body)
ok 3 - Item: <id> in the body judges the PR against that item, whatever the branch is called
# Item: rso-toy on build/fix-budget-rule: verdict gate passed (item rso-toy)
# Item: test-fixture-edges on build/rso-toy: verdict gate failed (item test-fixture-edges):\\n  no verify/test-fixture-edges/verdict.json at the head sha
ok 4 - an Item line naming an id plan/items/ lacks is refused
# verdict gate failed:\\n  the body names item no-such-item, which plan/items/ doesn't have
# tests 4
# pass 4
# fail 0
```
