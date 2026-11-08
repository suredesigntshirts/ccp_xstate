# suite-and-scope

Head d9e142f7dc7235d4c964a5c364bdf942afc76afb, base 43b4f45a7b1f1512ec31c671a9ad4901b60c0628 (main after #217).

```
node --test --test-reporter=tap verify/map-once-traps-written/suite-and-scope.test.mjs
```

4/4 pass. Plan check passes. `.github/workflows/verdict.yml` has no PR_BRANCH and keeps BASE_SHA, HEAD_SHA, PR_BODY,
PR_LABELS. `git diff --name-only 43b4f45 d9e142f`: .github/workflows/verdict.yml, CLAUDE.md, docs/layout.md,
docs/traps.md, plan/items/map-once-traps-written.md, test/docs.test.mjs: the five outputs and the item. In a depth-1
clone the test fetched the base at depth 1 and passed.

npm test in a full-history clean clone of the head (npm ci): see the result line below.

npm test, full-history clean clone at d9e142f with origin/main reachable: tests 1902, pass 1896, fail 1, skipped 5.
The one failure is verify/rules-said-once/suite-and-scope.test.mjs ("the PR changes only the files its outputs name"),
which reads origin/main's merge-base when it is reachable and so sees this PR's files; it is a known fault of that
frozen suite, fixed in another thread. On ci's depth-1 checkout (job 128708711185 at d9e142f) the same suite gives
tests 1902, pass 1885, fail 0, skipped 17, and the plan check "8 stages, 96 items (85 live), 90 ledger rows, 17 cases /
plan ok".
