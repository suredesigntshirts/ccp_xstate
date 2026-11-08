# ci

PR #213 check runs at c2e8cba91c52147f95a18530e74103fec26f815b: `test` (ci) success, run 42473517701 job 128709608435,
10:56:16Z-11:00:41Z. `gates` (job 128709609079) failed only at the verdict step: "no verify/fix-event-close-tag/verdict.json
at the head sha"; this verdict commit is what it reads.

At the earlier head 87976fe ci was red (run 42471834110): verify/harness-glossary "glossary-real" (the glossary line
named host.js `refusal`, which is not exported) and the plan-check tests over a plan copy missing the item's module
path. The builder fixed both by c2e8cba; locally at c2e8cba verify/harness-glossary/glossary.test.mjs and
test/plan-check.test.mjs pass 14/14 and `node plan/check.mjs` says plan ok.
