# ci

PR #297 at b467da6d5b029de53461e9d8ce479a0ad03fae71: test (job 129332845172) success, 17:40:24Z to 17:42:06Z. gates
(job 129332847498) failure; run locally at the same sha, `BASE_SHA=origin/main PR_BODY='Item: memory-learnings-written'
node scripts/gates/pr-gate.mjs verdict` prints only `no verify/memory-learnings-written/verdict.json at the head sha`,
which this verdict answers. Both run again on the verdict commit.
