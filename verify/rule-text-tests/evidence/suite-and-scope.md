# suite-and-scope

Head `772c1ad68d096cb0956aea1547f70976fc479a51`. `node plan/check.mjs`: plan ok. `PR_BODY="Item: rule-text-tests" node --test
verify/rule-text-tests/suite-and-scope.test.mjs`: 3/3, PR mode, 3 files against origin/main (1c0c9cdd): docs/layout.md,
plan/decisions/2026-11-08-refine-round-8.md, plan/items/rule-text-tests.md. In a `git clone --depth 1` of the head
with this folder copied in, `node --test "verify/rule-text-tests/*.test.mjs"`: 17/17, tree mode. npm test at the
head is ci's test job 128749408725 (run 42486495753): success.
