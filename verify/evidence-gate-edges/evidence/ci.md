# ci

Command: pull_request_read get_check_runs on PR #239 at the head 9cec4e1d409949f143818904d5a2500cb8f9ec3c.

Excerpt:

- ci test, run 42480352708 (job 128730721484): success, 12:27:39 to 12:33:53Z, on the merge of 9cec4e1d409949f143818904d5a2500cb8f9ec3c into main.
- verdict gates, run 42480352523: every step passes except the verdict step, which reports "no verify/evidence-gate-edges/verdict.json at the head sha".
  It re-runs on the commit that adds this file, which changes only verify/evidence-gate-edges/.

Earlier heads: at 10dad10 the test job failed on three verify/item-head-trim tests from main's plan state (main was red
too). At 0295c11 it failed twice on verify/fix-trace-writes-clone-cwd/scope.test.mjs ("base and head commits
readable"). Both are outside this diff; see the verdict's observations.
