# suite-and-scope

At the build head ae70217b923d39bba381423bcafba64ae3cda3ea:

```
PR_BODY='Item: item-writer-gaps' BASE_SHA=origin/main node --test verify/item-writer-gaps/suite-and-scope.test.mjs
```

```
Subtest: node plan/check.mjs passes
plan ok
Subtest: test/docs.test.mjs passes, the entry-text budget among its checks
\# pass 14, \# fail 0
Subtest: the PR changes only its outputs, its item, its decisions file and its verify folder
PR mode: 6 files: CLAUDE.md, plan/README.md, plan/check.mjs, plan/decisions/2026-11-08-refine-round-9.md, plan/items/item-writer-gaps.md, test/plan-check.test.mjs
Subtest: CLAUDE.md names the four steps as leading to done, and the README field table has no reader_effort row
`plan/README.md`, "How an item moves", gives the four steps to done, with each PR's branch, label and `Item:` line; `docs/gates.md` gives what the gates check
tests 4
pass 4
fail 0
```

Without PR_BODY (tree mode, as ci.yml's depth-1 checkout runs it) the same 4 tests pass. All 16 tests of verify/item-writer-gaps/ also pass in a depth-1 clone of the head. npm test as a whole: the PR's ci test job (see ci.md).
