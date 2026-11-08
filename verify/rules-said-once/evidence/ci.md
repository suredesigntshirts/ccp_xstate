# ci

Read with pull_request_read get_check_runs on PR #202 and get_job_logs.

- `test` (ci.yml), run 42471196731, job 128702090263, at head d6df5a7674e7ca52454c4b388542b0343cba39e6: success
  (10:23:03Z to 10:28:40Z).
- `gates` (verdict.yml), job 128702091038, same head: stubs, freeze and evidence passed; the verdict step's only
  refusal was `verdict gate failed (item rules-said-once): no verify/rules-said-once/verdict.json at the head sha`.
  Both rerun on the commit that adds this folder, which changes only verify/rules-said-once/.
