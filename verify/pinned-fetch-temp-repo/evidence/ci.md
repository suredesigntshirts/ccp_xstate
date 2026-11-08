# ci

PR #247 at head 6ff276e37502a5b3a0e88b2835b31e9b1ff72702, read with pull_request_read get_check_runs and get_job_logs.

- test job 128744836979: success (13:26:52Z to 13:33:26Z).
- gates job 128744837014 failed only for "no verify/pinned-fetch-temp-repo/verdict.json at the head sha". It reruns on
  the verdict commit, which changes only verify/pinned-fetch-temp-repo/.
