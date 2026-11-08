# ci

PR #230 check runs at ec2090105e18670277bb2e4f513c909508edef64, read with the GitHub API (`pull_request_read
get_check_runs`, `get_job_logs`):

- `test` job 128711988319 (ci.yml, run 42474279364): completed, success, 11:06:40Z to 11:12:58Z.
- `gates` job 128711988178 (verdict.yml, run 42474279339): failure, its only refusal `verdict gate failed (item
  item-head-trim): no verify/item-head-trim/verdict.json at the head sha`. It runs again on the verdict commit, which
  changes only verify/item-head-trim/.
