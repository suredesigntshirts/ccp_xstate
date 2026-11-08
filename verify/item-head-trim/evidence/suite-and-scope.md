# suite-and-scope

Sha: ec2090105e18670277bb2e4f513c909508edef64.

## Scope

Command: `node --test verify/item-head-trim/scope.test.mjs`. It compares the trees of the head and the PR's base
a4e3a59d151bcea666621a7bd9024fc14d410378 (main at the merge of #212), fetching both at depth 1 into a temp bare repo
when the checkout lacks them. It passes in this container's clone and in a fresh `git clone --depth 1` of the branch.

```
✔ the build changes only the files its outputs name and its own item file
ℹ a4e3a59d..ec209010: plan/README.md, plan/item.schema.json, plan/items/item-head-trim.md, test/plan-check.test.mjs
ℹ outputs: plan/item.schema.json, plan/check.mjs, test/plan-check.test.mjs, plan/README.md
```

`plan/check.mjs` is named as an output but not changed; its output line allows that ("No change beyond what the
schema drives").

## Suite

GitHub's ci `test` job 128711988319 ran `npm test` at ec20901 in ci.yml's depth-1 checkout: success.

Locally, `npm ci && npm test` in this container's clone (shallow, with origin/main fetched): 1968 tests, 1961 pass,
2 fail, 5 skipped. Both failures come from this clone, not the build:

- `verify/fix-budget-rule/backfill-true.test.mjs`, "every done fix item: module and done_on set, ...": the clone is
  shallow, and the same file fails the same way in a worktree at the base a4e3a59d.
- `verify/plan-reader-effort/plan-and-suite-pass.test.mjs`, "the PR changes only the files its outputs name, ...":
  with origin/main present it diffs any branch against main and checks the result against plan-reader-effort's
  outputs, so on this PR it reports `plan/items/item-head-trim.md`. It skips that diff in ci.yml's checkout, which
  has no origin/main.
