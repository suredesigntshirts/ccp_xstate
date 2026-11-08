# Refine round 3: one map, and the container traps in the repo (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 3 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

## 1. One map

`CLAUDE.md`'s Layout table and `docs/layout.md`'s tree both map the repo and each misses folders the other has. The
table is the one every session loads, so it is the map; `docs/layout.md` keeps the rules that do not fit a table
(tests, comments, dependencies). A test makes the map complete by construction: a new top-level or `scripts/` folder
fails CI until the map names it (Pragmatic Programmer: DRY, broken windows; Ousterhout: information leakage).

## 2. The traps go in the repo

Project memory holds four container traps every builder and verifier meets: the container signs commits, so evidence
quoting a sha uses `GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false`; container clones can be shallow, so
history-reading tests need `git fetch --unshallow origin`; a headless `claude -p` inherits
`CLAUDE_CODE_REMOTE_SESSION_ID` and files its rows under the thread unless it is unset; and running `npm test` in a
checkout and its worktree at once makes the two runs interfere. A thread without the memory loses a round to each
(ledger L-rules-live-in-the-repo). They go in `docs/traps.md`, outside the entry-text budget, with one pointer line.

Where a trap could be removed by code (defining the error out of existence), the entry names it and a later item
fixes it; this round only writes them down.

## 3. `PR_BRANCH`

Since `rules-said-once` no gate reads it (verifier observation). It leaves `verdict.yml`; tests that set it for their
own gate runs are unaffected.
