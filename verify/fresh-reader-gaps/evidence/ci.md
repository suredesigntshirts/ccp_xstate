# ci

`pull_request_read get_check_runs` and `get_job_logs` on PR #256 at `7d35231e495c41b2dae36edb936fdf8494648814`:

- test job 128741173622: success (npm test 2082 tests, 0 fail; plan ok).
- gates job 128741173650: failure only for "verdict gate failed (item fresh-reader-gaps): no
  verify/fresh-reader-gaps/verdict.json at the head sha". It reruns on this verdict commit, which changes only
  verify/fresh-reader-gaps/.
