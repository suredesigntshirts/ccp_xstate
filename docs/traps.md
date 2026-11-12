# Container traps

Things a thread in the cloud container meets that the repo's code cannot see. Each says how it shows and what avoids
it. A trap that code could remove is named here until an item removes it. This is a notes file: any PR may add or
correct an entry with no `Item:` line (`docs/gates.md`), so a thread writes a trap here in the PR where it met it,
never only in project memory.

## The container signs commits

`/root/.gitconfig` sets `commit.gpgsign` with an SSH key, so every commit carries a signature. A test or an evidence
file that builds a temp repo and quotes its shas gets different shas on every run, and a run elsewhere cannot match
them. In temp repos, commit without the container's config:
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false -c user.name=t -c user.email=t@example.com commit ...`.

## Clones can be shallow

A container clone may stop at a shallow boundary, so a test that reads history (a done item's first commit, a merge
base) fails with "shallow boundary" or a missing commit. Run `git fetch --unshallow origin` once, then rerun. `ci.yml`
checks out at depth 1, so a test that `ci` runs must pass without history. A test that needs a pinned commit fetches
it at depth 1 into a temp bare repo and reads it there, never into the checkout: `npm test` runs suites in parallel,
and fetches into one shallow repo collide on `.git/shallow.lock`.

## A scope test reads git only on its own PR

A verifier's test that a PR "changes only these files" reads the file list from git against `BASE_SHA` or
`origin/main`. Once that PR merges, every full clone of another branch sees that branch's own files and fails. Read git
only when `PR_BODY`'s `Item:` line names the test's item (`namedItem` in `scripts/gates/lib.mjs`, as the verdict job
sets it), and otherwise check the scope from the tree.

## A headless session inherits the thread's session

`claude -p` started from a thread inherits `CLAUDE_CODE_REMOTE_SESSION_ID`, so its rows and commits are filed under
the thread's session. A reader that must count as its own session is a fresh reader (`docs/verifying.md`).

## One suite at a time

Do not run `npm test` in a checkout and its git worktree at once: the two runs interfere. Run one, then the other.
The full suite takes minutes; a builder runs the tests near its change locally and leaves the full suite to `ci`.

## A red test the PR did not touch

A `ci` test outside the PR's change can go red for timing or a race in the container that runs it. Re-run the check
once, saying so on the PR; red again, it is a real failure, fixed in that PR or named as a new item.

## What a thread may not do to GitHub

Auto mode and the session's git proxy refuse a thread a force push, an amend or rebase of a pushed branch, a branch
delete (`git push --delete` hangs up), a tag push, and at times `release.mjs --push`, read as a production deploy.
A refusal is not reproduced to check it: retrying reads as a bypass (`plan/ledger/platform.md`,
L-retries-look-like-bypass). Fix a pushed branch with a follow-up commit or by merging main in, and list branches
left to delete in `plan/decisions/waiting-for-person.md`.

## Plugin tests leave out untracked files

The plugin tests install the working tree as a commit made with `git stash create`, so an uncommitted change is
tested, but `git stash create` leaves untracked files out. A new file the change adds is missing from the install
until it is in the index: run `git add` on it before the tests. A clean-room run with `--ref` installs only that
commit, so commit first.

## A background run owns its checkout

A test or trial left running in the background reads the checkout as it goes. Do not stash, check out or switch
branches in that checkout until it ends; it then tests a tree that changed under it. Do other work in a git worktree,
or in a fresh clone.

## The project files folder is a network mount

`/mnt/project-files` refuses hard links (`ln` fails, "Operation not supported" or "Invalid cross-device link"), and
git refuses a worktree or repo there as "dubious ownership". Another thread may hold the same file, and the last
write wins, so write a new file with a version in its name rather than rewrite a shared one. Keep clones and test
folders on the container's disk.

## PR events that run nothing

A thread waiting on a CI event may never be woken by it: check the PR's checks when it wakes for anything else, and
ask to be nudged rather than wait. A push that only merges main in may start no `ci` run; read the checks at the new
head before counting it green. A PR opened before the PR under it merged keeps that older `BASE_SHA` in its
runs until its branch is updated, so its gates read files that are already on main as its own.

## A draft PR stops the engine's merge

The merge effect merges over REST at the verified sha, and GitHub refuses a draft PR ("Pull Request is still a draft").
The item then goes to its replan ask, not back to the merge. A builder that opens its build PR as a draft marks it ready
(`update_pull_request` with `draft: false`) before the item reaches its merge ask; marking it ready runs no new checks
and moves no head.

## New threads resume an old container

A new thread does not get a fresh container: the environment boots it from a snapshot made when the setup script last
ran (`/tmp/env-manager.log` says `session_mode: resume-cached`), refreshes only the repo clones, and skips `setup.sh`.
So `~/.claude/skills/ccp-harness` holds the release that was newest at that snapshot, and a release cut later reaches
no thread. It shows as the SessionStart self-check failing with "runs release X but Y is out" in thread after thread,
and as `/tmp/ccp-xstate-setup.log` having only one `setup start` line, older than the session. The self-check's advice
to start a new thread does not help here. What helps is a re-save of the environment's setup script (any change, such
as the trailing `# date` comment), which makes the next thread build a fresh container and run `setup.sh`; it is a
setting, so it is the person's (`plan/decisions/waiting-for-person.md`). Check with `grep "setup start"
/tmp/ccp-xstate-setup.log` against the session's start time.
