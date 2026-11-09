# ci

Command: GitHub check runs for PR #286 at 188c9b9620b4fa41fbe161cd921ed94bccf89fad

Excerpt: test (job 129110741497) success, 10:40:59Z to 10:41:52Z, "plan ok"; gates (job 129110739903) failed only at
its last step with "verdict gate failed (item batched-gate-reads): no verify/batched-gate-reads/verdict.json at the
head sha", which this verdict answers. Both run again on the verdict commit, where the verdict gate runs this folder's
tests under ci's git 2.56.
