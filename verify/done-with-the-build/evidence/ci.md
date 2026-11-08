# ci

PR #243, head 807999f1362281bc882f39a584bbd20935748762, read with pull_request_read get_check_runs and get_job_logs.

- test job 128722108570: completed, success (11:51:06Z to 11:56:45Z).
- gates job 128722108544: failure, only for "verdict gate failed (item done-with-the-build): no
  verify/done-with-the-build/verdict.json at the head sha". It reruns on this verdict commit, which changes only
  verify/done-with-the-build/.
