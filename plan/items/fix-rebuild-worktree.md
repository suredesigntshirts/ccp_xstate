```json
{
  "id": "fix-rebuild-worktree",
  "title": "Start a rebuild in the previous PR's branch at its head",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "When quick-fix goes back to building with previous set, the build run's worktree is on the previous PR's branch at the PR's head, and its run line names that branch, so the builder fixes the code it is told about without switching branches.",
  "why": "In the trial-fail-path fail trial, the rebuild's worktree was a new branch run/trial/4.build at main while previous said to push to PR #1's branch (run/trial/1.build). The build rules say both 'use no other branch name' and 'when previous is set, push to that PR'. The agent resolved it itself (fetch, reset --hard to the old branch, push HEAD:run/trial/1.build), but the worktree did not hold the code being fixed, and a weaker agent could open a second PR or rebuild from scratch. actors.prepare adds every worktree with -B <run branch> from the clone's HEAD.",
  "serves": [
    "L-replan-after-second-fail"
  ],
  "depends_on": [
    "trial-fail-path"
  ]
}
```

## What this is

Found by trial-fail-path (tournaments/2026-11-04-stage-contract/trials/fail/report.md, 4.build). Options to weigh in
the replan that readies it: prepare the worktree from the previous PR's head on its branch (fetching it first), or keep
the fresh branch and change the build rule so the PR moves to it. The first keeps one PR and one branch per attempt.
