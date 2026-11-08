# ci

PR #212 check runs at head 314dbde98001790c85284a7e28c4be8923ae6fd6 (GitHub, read 2026-11-08 ~11:00Z):

- `test` (ci, job 128707174550): success, 10:45:24Z to 10:51:06Z.
- `gates` (verdict, job 128707174833): failure, and only at the verdict step: "verdict gate failed (item
  plan-reader-effort): no verify/plan-reader-effort/verdict.json at the head sha". Locally, with
  BASE_SHA=origin/main PR_BODY="Item: plan-reader-effort", the stubs, freeze and evidence gates print "... gate passed
  (item plan-reader-effort)". That refusal is the one this verdict answers; the checks rerun on the verdict commit.
