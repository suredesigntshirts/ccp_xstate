# Rebuild worktree: on the previous PR's branch at its head (2026-11-05)

Item: fix-rebuild-worktree. Two-way doors, decided by the building thread as the person's stand-in.

## The problem

`prepare` adds every run's worktree with `git worktree add -B run/<item>/<run> <worktree> HEAD`. On a rebuild
(`previous` set) that is a fresh branch at main, while the build rules say to push to the previous PR and to use no
other branch name. In trial-fail-path the agent reset its worktree to the old branch by hand.

## Decisions

1. **Put the worktree on the PR's branch, not change the rule.** The other option, keeping the fresh branch and
   moving the PR to it, needs a second PR or a force-push of the PR's head, and still leaves the worktree without the
   code being fixed. One attempt keeps one PR and one branch.
2. **The branch comes from GitHub, stamped at accept.** `accept` already reads the PR (`github.pull`) to check its head;
   it now also stamps `branch` (GitHub's `head.ref`) on the ref, a new STAMPED field the agent may not set or see. The
   earlier run's branch name is not used: a builder given `branch` pushes elsewhere, and the host trusts what it sees.
   A fork PR (head.repo not the PR's repository) gets no branch.
3. **The worktree starts at `previous.at`,** the head the host last saw (the builder's claimed head, or the head CI
   was green on), which is the commit the verdict or the red check is about. If the commit is not in the clone, the
   host fetches `pull/<n>/head` and the branch from origin first. The local branch gets origin's branch as upstream
   when origin has it, so a plain `git push` lands on the PR.
4. **A finished run's worktree that holds the branch is detached first.** git refuses `-B` on a branch checked out
   in another worktree, even with `--force`. The first build's worktree usually holds it. The host detaches that
   worktree's HEAD (its files and commits stay) only when the worktree is inside the host's own worktrees folder;
   a branch held anywhere else (the clone's own checkout) is left alone and the run fails.
5. **Fails closed.** With `previous` set but no stamped branch, or `previous.at` not found after the fetch, the run
   fails with a reason, and the item steps back as any failed run does. A fresh-branch fallback was set aside: it is
   the bug this item fixes, and a fork PR cannot be pushed to anyway.
