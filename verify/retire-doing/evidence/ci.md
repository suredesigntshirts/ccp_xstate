# ci

PR #250, head 472f72c52a39ebae3da5e74b5d23248a747a59b8, read with pull_request_read get_check_runs and get_job_logs.

- test job 128733732063: completed, success (12:40:22Z to 12:45:23Z); `# tests 2046`, `# pass 2029`, `# fail 0`,
  then `plan ok`.
- gates job 128733732218: failure, only for "verdict gate failed (item retire-doing): no
  verify/retire-doing/verdict.json at the head sha". It reruns on this verdict commit, which changes only
  verify/retire-doing/.
