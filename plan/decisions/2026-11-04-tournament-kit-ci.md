# Tournament CI: pull_request from the base branch's kit, lanes updated from the base (2026-11-04)

Plan item `tournament-kit`. Two-way doors decided by the builder thread:

- **Trigger.** `scripts/tournament/ci/tournament.yml` runs on `pull_request` into `tourney/**`, not
  `pull_request_target`. A `pull_request` run's check runs land on the PR head sha, which is where the item's
  `ci-scratch` line reads them, and it keeps a read-only token while running lane code. The job checks out the base
  branch separately for `scripts/tournament/` and `tournaments/<id>/`, so the measure and config are the base's, not
  the lane's. A lane could still edit the workflow file in its own merge ref; lanes are records written by the
  tournament session, so that stays a known gap rather than a reason for `pull_request_target`.
- **Existing lane PRs.** PRs #37-#41 were opened before their base carried the CI. Each was updated from the base
  (GitHub's "Update branch", a merge of the base into the lane). The lane's own diff against the base is unchanged and
  the judged commit stays in its history; `measure.mjs` diffs engine files against the base snapshot sha, so the kit
  files the merge brings in don't count. Closing and reopening PRs, or empty commits, were ruled out.
- **Where summaries are read.** Job summaries are not served by the REST API, so `measure.mjs --summary` also prints
  the summary to the job log, and the JSON is uploaded as an artifact.
- **The first tournament's runner sha** is the scratch base snapshot `dbc40bf` with `path: runner.js`, because it ran
  before the kit existed. Its prompts and schemas were lifted unchanged into the folder so the generic runner can
  rerun it.
