# suite-and-scope

At 472f72c52a39ebae3da5e74b5d23248a747a59b8, checkout of build/retire-doing, `npm ci` then:

- `node plan/check.mjs`: `8 stages, 101 items (90 live), 90 ledger rows, 17 cases` / `plan ok`.
- `npm test`: tests 2059, pass 2053, fail 1, the rest skipped. The one red is fix-budget-rule's "every done fix item:
  ... done_on = first done commit date", which reads git history this shallow branch clone lacks (known local-only).
  ci's test job at the same head: 2046 tests, 2029 pass, 0 fail.
- `node --test verify/retire-doing/scope.test.mjs`: the build commit's range f8d0ef39..472f72c5 (from the readying
  replan it stacks on) changes 22 files, each an output or plan/items/retire-doing.md, and the item says done. The suite
  also passes in a depth-1 clone, fetching both commits into a temp bare repo.
