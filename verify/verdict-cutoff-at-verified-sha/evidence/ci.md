# ci

Command: GitHub MCP pull_request_read get_check_runs on PR #223, and get_job_logs for the gates job.

Excerpt at 5005ddad872eb02941838cd88ceb900dbd7ef49a: test job 128709145689 (run 42473372598): success, attempt 1. gates job 128709145001: stubs, freeze and
evidence passed; verdict failed with only "no verify/verdict-cutoff-at-verified-sha/verdict.json at the head sha". It
reruns on the verdict commit, which changes only verify/verdict-cutoff-at-verified-sha/.
