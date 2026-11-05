```json
{
  "id": "fix-rebuild-worktree",
  "title": "Start a rebuild in the previous PR's branch at its head",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "When quick-fix goes back to building with previous set, the build run's worktree is on the previous PR's branch at the PR's head, and its run line names that branch, so the builder fixes the code it is told about and pushes to the same PR without switching branches.",
  "why": "In the trial-fail-path fail trial, the rebuild's worktree was a new branch run/trial/4.build at main while previous said to push to PR #1's branch (run/trial/1.build). The build rules say both 'use no other branch name' and 'when previous is set, push to that PR'. The agent resolved it itself (fetch, reset --hard to the old branch, push HEAD:run/trial/1.build), but the worktree did not hold the code being fixed, and a weaker agent could open a second PR or rebuild from scratch. actors.prepare adds every worktree with -B <run branch> from the clone's HEAD.",
  "serves": [
    "L-replan-after-second-fail"
  ],
  "depends_on": [
    "trial-fail-path"
  ],
  "cases": [
    "C-red-ci-back-to-building",
    "C-second-fail-replans"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js prepare",
      "what": "Adds every run's worktree with git worktree add -B run/<item>/<run> from the clone's HEAD, whatever the run's input says"
    },
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "Already reads the claimed PR from GitHub (github.pull) to check its head sha, and stamps key, checkout, gates and green on the ref"
    },
    {
      "ref": "packages/engine/src/stages.js STAMPED",
      "what": "The fields the host stamps on a ref { url, at }: an agent may not set them and is not shown them"
    },
    {
      "ref": "workflows/quick-fix.json build",
      "what": "Build rules and inputs: 'when previous is set, push to that PR instead of opening one. Use no other branch name.'"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/fail/report.md",
      "what": "4.build: the rebuild's worktree was run/trial/4.build at main; the agent reset it to PR #1's branch itself"
    },
    {
      "ref": "plan/decisions/2026-11-05-rebuild-worktree.md",
      "what": "Where the branch comes from, how its worktree is freed, and what fails closed"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "Stamps branch on a PR ref: GitHub's head.ref, only when head.repo is the PR's own repository"
    },
    {
      "ref": "packages/engine/src/stages.js STAMPED",
      "what": "branch added, so an agent may not set it; it stays shown in prompts, while key, gates, green and checkout stay hidden"
    },
    {
      "ref": "packages/engine/src/actors.js prepare",
      "what": "A run whose input.previous is a PR ref with a stamped branch gets its worktree on that branch at previous.at (fetched from origin first when missing; the finished run's worktree holding the branch is detached first); run.json and the run line name that branch. With previous set and no stamped branch, or at not found after the fetch, the run fails with a reason and the item steps back"
    },
    {
      "ref": "workflows/quick-fix.json build",
      "what": "Unchanged: its rule already agrees once the worktree is on the PR's branch, and the trial-fail-path verifier pins its hash (decision 6)"
    },
    {
      "ref": "packages/engine/test/actors.test.js",
      "what": "The builder's tests of the rebuild worktree over a local bare origin"
    },
    {
      "ref": "packages/engine/README.md",
      "what": "Where a run's worktree starts, first build and rebuild"
    }
  ],
  "expect": [
    {
      "id": "rebuild-on-branch",
      "check": "Through the engine with a clone whose origin is a local bare repo and a stub GitHub whose PR head.ref is the branch the first build pushed (head.repo the same repo), a quick-fix item whose verify FAILs goes back to building and the new build run's worktree has HEAD equal to the PR's at and is on that branch (git rev-parse --abbrev-ref HEAD), its run.json branch and its context.md run line name it, and a commit made there goes to origin's branch with a plain git push; the same holds when the item comes back to building from a red check_run; a first build still gets run/<item>/<run> at the clone's HEAD",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "branch-stamped",
      "check": "accept stamps pr.branch from GitHub's head.ref when head.repo.full_name is the PR's repository and leaves it unset for a fork PR; a build result that sets pr.branch itself is refused with rule reserved; unlike key, gates, green and checkout, branch is shown in prompts (the rebuild's previous input names it), so earlier stage records and their checkers stay true",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "fails-closed",
      "check": "A rebuild whose previous has no stamped branch (a fork PR), or whose previous.at is in neither the clone nor origin, fails its run with a reason naming the cause and the item steps back to replanning; no worktree on a fresh branch is made for it; a branch held by a worktree outside the host's worktrees folder (the clone's own checkout) is not touched and fails the same way",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "builder-tests",
      "check": "The builder's tests in packages/engine/test/actors.test.js cover the rebuild worktree and go red when prepare is reverted to always branch from HEAD",
      "how": "Builder's test, broken by the verifier",
      "proof": "builder"
    },
    {
      "id": "real-pr",
      "check": "On suredesigntshirts/ccp_xstate_scratch: bin/host.js with stub agents takes a quick-fix item through a first build that opens a real PR from its run branch, a FAIL verdict, and a rebuild; the rebuild's worktree is on that PR's branch at its head, a commit pushed from it with plain git push shows on the same PR on GitHub, and no second PR is opened",
      "how": "The verifier's own run in its thread, with the PR's commits and the repository's open PRs read from GitHub after",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "pr.branch (a host-stamped ref field)"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to how a first build's worktree or branch is made",
    "No support for rebuilding a fork PR: the builder could not push to it either, so the run fails closed",
    "No removal of the finished run's worktree: it is detached, its files and commits kept",
    "No change to verify runs, which already check out the head detached from pr.checkout"
  ],
  "records": [
    "brief.stored rows whose run's context names the PR's branch",
    "effect failed rows with the reason when a rebuild's branch or head cannot be found"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

Found by trial-fail-path (tournaments/2026-11-04-stage-contract/trials/fail/report.md, 4.build). A rebuild's
worktree was a fresh branch at main while the build rules said to push to the previous PR. This item puts the
rebuild's worktree on the PR's own branch at the head the host last saw, so one attempt keeps one PR and one branch,
and the code being fixed is the code in the worktree. The branch comes from GitHub (head.ref, read at accept), not
from the earlier run's name, because the builder may push to a branch other than its run branch. How it is done and
what fails closed is in plan/decisions/2026-11-05-rebuild-worktree.md.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read plan/decisions/2026-11-05-rebuild-worktree.md
and C-red-ci-back-to-building and C-second-fail-replans in plan/cases/work-item.md, and write your own tests under
`verify/fix-rebuild-worktree/` without reading the builder's. For rebuild-on-branch, branch-stamped and fails-closed,
drive the engine in a temp folder with a clone whose `origin` is a local bare repo, a stub GitHub REST server
(packages/engine/test/tourney/world.js shows one) and stub agents: a first build that commits in its worktree, pushes
to origin and returns its PR, then a FAIL verdict or a red check_run, then read the rebuild's run folder and worktree.
For real-pr, do it in your own thread against suredesigntshirts/ccp_xstate_scratch with bin/host.js and stub agents
(scripts/toy-run.sh and the fix-finish-closes-waits verifier show how), then read the PR's commits and the open PRs;
close the PR when done. Revert prepare to always branch from HEAD and show the builder's tests going red. Read the ci
check at the head sha. Commit `verify/fix-rebuild-worktree/verdict.json` with a verdict per Expect id.
