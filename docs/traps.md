# Container traps

Things a thread in the cloud container meets that the repo's code cannot see. Each says how it shows and what avoids
it. A trap that code could remove is named here until an item removes it.

## The container signs commits

`/root/.gitconfig` sets `commit.gpgsign` with an SSH key, so every commit carries a signature. A test or an evidence
file that builds a temp repo and quotes its shas gets different shas on every run, and a run elsewhere cannot match
them. In temp repos, commit without the container's config:
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false -c user.name=t -c user.email=t@example.com commit ...`.

## Clones can be shallow

A container clone may stop at a shallow boundary, so a test that reads history (a done item's first commit, a merge
base) fails with "shallow boundary" or a missing commit. Run `git fetch --unshallow origin` once, then rerun. `ci.yml`
checks out at depth 1, so a test that `ci` runs must pass without history.

## A scope test reads git only on its own PR

A verifier's test that a PR "changes only these files" reads the file list from git against `BASE_SHA` or
`origin/main`. Once that PR merges, every full clone of another branch sees that branch's own files and fails. Read git
only when `PR_BODY`'s `Item:` line names the test's item (`namedItem` in `scripts/gates/lib.mjs`, as the verdict job
sets it), and otherwise check the scope from the tree; `verify/rules-said-once/suite-and-scope.test.mjs` does this.

## A headless session inherits the thread's session

`claude -p` started from a thread inherits `CLAUDE_CODE_REMOTE_SESSION_ID`, so its rows and commits are filed under
the thread's session. Start it with `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p ...` when it must count as its own
session, such as a fresh reader for an Expect line.

## One suite at a time

Do not run `npm test` in a checkout and its git worktree at once: the two runs interfere. Run one, then the other.
The full suite takes minutes; a builder runs the tests near its change locally and leaves the full suite to `ci`.
