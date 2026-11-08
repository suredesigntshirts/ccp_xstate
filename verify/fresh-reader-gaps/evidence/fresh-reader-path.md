# fresh-reader-path

Run 2026-11-08 by the verifier, in a clean clone of the build head `7d35231e495c41b2dae36edb936fdf8494648814`
(cloned, head checked out, `origin` removed, `npm ci`), from the clone's root:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "Using only this repository, you are a new thread asked to build a ready plan item. Step by step, what do you do until it is done: which date goes in done_on, what do you write under verify/, who writes the verdict, how do you run one verifier suite locally, and what do you do after the merge? Cite the files."
```

Exit 0. The answer below is verbatim (stdout); stderr held one unrelated MCP credential notice.

## Answer

The order below follows `plan/README.md` and `docs/gates.md`, with a few details from `plan/check.mjs` and `docs/traps.md`. I didn't run anything.

## Steps

1. **Check the item and take the build branch.** Pick an item whose status is `ready` (`plan/README.md`, "How an item moves"). Read its prose, its `## Verifier brief`, and the `Expect` lines in its JSON head (`plan/items/<id>.md`, `plan/item.schema.json`). The readying replan is already done. It used branch `replan/<topic>`, label `replan` and no `Item:` line, and it is not your job.
2. **Name the branch for the item.** The branch is `<kind>/<id>`, for example `build/journal-schema`, with no `claude/` prefix (`CLAUDE.md`, "Working an item").
3. **Make the first commit set the status and the date.** Set `status` to `done` and `done_on` to the date that commit is made (see the `done_on` section below). The PR cannot merge until a verdict proves the outcome.
4. **Add the trailer to every commit.** End each commit with `Claude-Session: <id>` (`plan/README.md`; `docs/gates.md`, "Sessions").
5. **Build the item.** Run targeted tests locally and let CI run the full suite. Keep comments free of item ids, lanes and rounds (`CLAUDE.md`, Principles). Don't add stubs: no TODO, FIXME, "not implemented" or skipped tests under `packages/` or `plugins/` (`docs/gates.md`).
6. **Open the build PR.** Put `Item: <id>` in the body. That line is the only way a PR names its item, and it freezes the contract (`docs/gates.md`, "The contract freeze"). If the contract needs to change, one `replan`-labelled, plan-only PR may do it, with `contract_changes` set to 1 and a `## Contract change` section.
7. **Ask for a verifier.** Ask whoever started you to start a separate verifier session.
8. **Wait for green and merge.** Merge only when `ci` and `verdict` are both green at the head sha. If you need main after the verdict exists, merge main in rather than rebasing (`plan/README.md`, step 4).

## Which date goes in `done_on`

The date the item became done, as `YYYY-MM-DD` (`plan/item.schema.json`). In the build flow that is the day of the build PR's first commit, the one that sets the status to `done` (`plan/README.md`, step 2).

- `plan/decisions/2026-11-08-fix-budget-rule.md` reads the date in UTC.
- Setting `done_on` fresh in the first commit is free. Once it is set at the base, only a plan-only replan with a `## Done on change` section can move it (`docs/gates.md`, "The contract freeze").
- `check.mjs` refuses a done item that names a `module` but has no `done_on` (`plan/check.mjs:146`).
- `plan/decisions/2026-11-08-plan-reader-effort.md` says a done build item with `done_on` on or after 2026-11-09 also needs `reader_effort` in its head. Get it from `node scripts/reader-effort.mjs --item <id>`. Today is 2026-11-08, so it isn't required yet.

## What you write under `verify/`

Nothing. "The builder writes nothing under `verify/<id>/`" (`plan/README.md`, step 2). The verifier writes everything there:

- tests under `verify/<id>/`;
- one evidence file per Expect line, `verify/<id>/evidence/<expect-id>.md`, holding the command, the excerpt and the inputs to run it again;
- `verify/<id>/verdict.json`.

The evidence gate refuses anything over 64 KB, anything named `*.pass`, symlinks and test listings (`docs/gates.md`, "Evidence").

## Who writes the verdict

A separate session, given the item's Verifier brief and not your tests (`plan/README.md`, step 3). It commits `verdict.json` to your build PR's branch. The verdict gate refuses a verdict from a builder's session. It checks that the last commit to `verdict.json` has a `Claude-Session:` trailer that no commit outside `verify/` has (`docs/gates.md`, "The verdict").

## Running one verifier suite locally

```
node --test "verify/<item>/*.test.mjs"
```

Name the files, because a bare folder fails (`CLAUDE.md`, Commands).

- If it fails with "shallow boundary" or a missing commit, run `git fetch --unshallow origin` once and rerun (`docs/traps.md`, "Clones can be shallow").
- A suite that `ci` runs must also pass in a depth-1 checkout with no history.
- The gate itself runs `node --test-reporter=tap [--test-name-pattern=<test_name>] <file>`.
- To run the verdict gate locally: `BASE_SHA=origin/main node scripts/gates/pr-gate.mjs verdict`, with `PR_BODY` and `PR_LABELS` set.

## After the merge

No PR follows. There is no separate done replan, because the status already went to `done` in the first commit. Run this:

```
git fetch origin main && node scripts/release/release.mjs branch --push
```

- It pushes `release/harness-v<x.y.z>` if the merge changed a path in `RELEASED`: `plugins/harness`, `packages/journal`, `packages/engine/src`, and `packages/engine/messages.md`. The test folders of `plugins/harness` and `packages/journal` are excluded (`scripts/release/release.mjs:29`).
- Otherwise it does nothing (`docs/gates.md`, "After the merge"; `plugins/harness/README.md`, "Releases").
- Release branches are used because the git proxy drops tag pushes from threads.
- The thread that merged runs the release.

## Grading

Against the Expect line's four points, each answered from a cited repository file:

1. done_on takes the day of the build PR's first commit: MET ("the day of the build PR's first commit, the one that
   sets the status to `done` (`plan/README.md`, step 2)").
2. The builder writes nothing under verify/<id>/ and asks for a verifier rather than writing the verdict: MET
   ("Nothing. 'The builder writes nothing under `verify/<id>/`' (`plan/README.md`, step 2)"; step 7 "Ask whoever
   started you to start a separate verifier session"; the verdict is written by "A separate session").
3. One verifier suite runs with its test files named: MET (`node --test "verify/<item>/*.test.mjs"`, "Name the files,
   because a bare folder fails (`CLAUDE.md`, Commands)").
4. The merging thread runs the release command: MET (`git fetch origin main && node scripts/release/release.mjs
   branch --push`, citing `docs/gates.md`, "After the merge", and RELEASED at `scripts/release/release.mjs:29`).

One detail drawn from outside the three texts and right: it names `plan/decisions/2026-11-08-plan-reader-effort.md` for
reader_effort, which the repository still holds. `fresh-reader-path.test.mjs` regrades these points from this file and
checks each against the cited text at the checkout.
