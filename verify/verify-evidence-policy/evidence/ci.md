# ci

Command: GitHub MCP `pull_request_read get_check_runs` on PR #197, and `get_job_logs` on the first test attempt.

Excerpt at 7f52c6f6e724ab8af45cddf35cbde0847016f05e:
- `test` run 42468035197, attempt 1 (job 128692001509): 1888 pass, 1 fail, 18 skipped. The one failure was
  plugins/harness/test/capture.test.mjs:105 "cheap: hook.run rows show at most 50 ms median ... and 200 ms p95 per
  tool call", error "p95 319 ms": a timing bound in a file this PR does not touch. Plan check "plan ok".
- attempt 2 (job 128692863992, 09:42-09:47Z): success.
- `gates` run 42468035181 (job 128692001535): every step passed but verdict, "no
  verify/verify-evidence-policy/verdict.json at the head sha". It reruns on the verdict commit, which changes only
  verify/verify-evidence-policy/.
