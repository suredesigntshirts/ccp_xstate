# ci

PR #247 at head c761824bb4681ec79a7b644c965814cf0f16f191, read with pull_request_read get_check_runs and get_job_logs.

- test job 128737570048: success (12:56:54Z to 13:05:59Z).
- gates job 128737570145: failure, only for "no verify/pinned-fetch-temp-repo/verdict.json at the head sha". It reruns
  on the verdict commit, which changes only verify/pinned-fetch-temp-repo/.
