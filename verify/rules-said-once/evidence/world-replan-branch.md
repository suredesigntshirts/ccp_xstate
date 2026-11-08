# world-replan-branch

Throwaway PR https://github.com/suredesigntshirts/ccp_xstate/pull/203, title "throwaway: replan branch named for an
item, no Item line", branch `replan/test-fixture-edges`, head c9b485844a74c367b0e2dfe7b69b2462284c4e58 = the build head
528c009 plus one prose line appended to plan/items/test-fixture-edges.md (a draft item). Body: the attribution block and
a sentence, no Item line. Label `replan` added after opening, so the verdict workflow ran twice (opened, labeled).

Read with get_job_logs on gates job 128700048982 (the labeled run; PR_LABELS ["replan"]), step
"verdict at the head sha, from a separate session, its named tests run":

```
BASE_SHA: fbb3a50ade8c73cefaed4ac553e54f3ce1d90a3c
HEAD_SHA: c9b485844a74c367b0e2dfe7b69b2462284c4e58
PR_BRANCH: replan/test-fixture-edges
PR_LABELS: ["replan"]
verdict gate failed:
  this PR changes files outside plan/ but names no item (add an "Item: <id>" line to its body)
##[error]Process completed with exit code 1.
```

No "(item test-fixture-edges)" and no "no verify/test-fixture-edges/verdict.json": the gate on GitHub did not name an
item from the branch. Its only refusal is that the PR (which carries the build's own scripts/ and docs/ changes
against main) changes files outside plan/ with no Item line. Before this build, the same branch would have named
test-fixture-edges and demanded its verdict. Closed unmerged; branch deleted.
