# ci

Read with pull_request_read get_check_runs on PR #222 and get_job_logs, at head 37f6dfce1a6cc749ab3d973acbb26f826a8c890c.

- `test` (ci.yml), run 42473118175, job 128708329204: success (10:50:33Z to 10:55:16Z).
- `gates` (verdict.yml), run 42473118142, job 128708329404: the verdict step's only refusal was
  `verdict gate failed (item scope-suite-own-pr): no verify/scope-suite-own-pr/verdict.json at the head sha`.
  Both rerun on the commit that adds this folder, which changes only verify/scope-suite-own-pr/.
