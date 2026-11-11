# Memory boundary check

Does project memory stay directives and coordinator state once it is pruned, with traps going to the repo? The item is
`plan/items/memory-boundary-check.md`; the lesson is L-cheap-home-wins (`plan/ledger/process.md`).

Each snapshot under `memory-boundary-check/` lists one session's synced memory folder
(`$CLAUDE_COWORK_MEMORY_PATH_OVERRIDE/team/silo/`): file name, size, sha-256 and store entry id from
`.memory-sync-basis`, with the basis's entry count and pending deletes. No file bodies are committed.

## Snapshots

| # | File | Session | Folder synced | Store entries | Pending deletes |
|---|---|---|---|---|---|
| 1 | `1-2026-11-09T1824Z-before-prune.json` | builder, `session_01KfkB5JV6vrEnQts7qCrK4X` | 18:24:06Z | 151 | none |
| 2 | `2-2026-11-09T1834Z-after-prune.json` | builder, same session | 18:34:06Z | 5 | none |
| 3 | `3-2026-11-11T1044Z-after-second-item.json` | builder, same session, resumed | 11 Nov 10:44:17Z | 5 | none |

## The prune

The coordinator's first prune (18:23Z) did not reach the store. Snapshot 1, taken a minute later, holds all 151 files;
against `/mnt/project-files/memory-audit/archive-2026-11-09/` only `MEMORY.md` and
`feedback-refusals-find-alternatives.md` differ. Edits had synced and deletes had not, because the sync records a
delete only when a command is a plain `rm` of full paths under the mount (`plan/ledger/platform.md`,
L-memory-delete-shape). The pruning thread re-did the deletes in that shape.

Snapshot 2 is the first after the prune. It was taken in the same running session, whose folder re-synced at 18:34:06Z,
so a folder syncs during a session and not only at its start. Five files remain:

| File | Against the archive | Audit kind |
|---|---|---|
| `MEMORY.md` | trimmed to directives, state and pointers | (c) |
| `feedback-lead-architecture.md` | unchanged | (c) person feedback |
| `feedback-refusals-find-alternatives.md` | stale Actions-minutes line removed | (c) person feedback |
| `feedback-tap-only-production.md` | unchanged | (c) person feedback |
| `ccp-xstate-artifacts-refresh.md` | unchanged | (c) reference |

No file the audit sorts as a builder or verifier log (b) or as stale (d) is left. Two kept files still carry what the
project instructions now keep out of memory, written before that rule: `ccp-xstate-artifacts-refresh.md` names main
shas and release tags for each refresh, and `feedback-tap-only-production.md` names a PR number. Neither is a build
log; they are for the coordinator to trim.

## Observed items

### 1. memory-boundary-check

Builder thread "Check the memory boundary holds", `session_01KfkB5JV6vrEnQts7qCrK4X`. Its PRs are the readying
replan and this build PR.

- **Memory written:** none. The thread wrote its snapshots to `/mnt/project-files/memory-boundary-check/` and the
  repo, and deleted nothing.
- **Traps met and their homes:**
  - The checkout's `origin/main` was days behind the designated branch, so a branch cut from it lacked this item's
    file. Now in `docs/traps.md`, "The checkout's `origin/main` can be days old".
  - The readying PR's first `ci` run concluded failure with no jobs; one re-run ran its job green. Now in
    `docs/traps.md`, "A `ci` run that has no jobs".
  - The delete shape that kept the first prune from landing is a platform fact, so it went into
    `plan/ledger/platform.md` as L-memory-delete-shape.
- **Verifier thread:** to be added once it has run; the verifier lists its own folder.

### 2. second-workflow

Builder thread "Build the second workflow" (`cmsg_01VhYV3jhQ9s4qrrh2th12sNWnUTYuH9V5sYfU3qRE4N7M`) and verifier thread
"Verify the second workflow" (`cmsg_01VhYV3jhQ9s4qrrh2th12sNBALxb61puq7VezRGda1a9D`), 11 Nov 09:22Z to 10:44Z. Its PRs:
the readying replan, the build PR with three slice PRs merged into its branch, and a plan-only follow-up that files
what the run left.

- **Memory written:** none by either thread. Between snapshots 2 and 3 no file was added or removed, and the only
  changed file is `MEMORY.md`, which the coordinator keeps. Its new lines are directives with the person's message ids
  and state as thread pointers; they name no PR number, sha, verdict or release time. A listing shows the store at its
  sync times only, so a file written and deleted between two snapshots would not show.
- **Traps met and their homes:**
  - GitHub refuses to merge a draft PR, so the engine's merge effect failed on the build PR. The follow-up PR adds
    "A draft PR stops the engine's merge" to `docs/traps.md` and files `fix-merge-draft-pr` as a plan item.
  - The release command was refused as a production deploy. `docs/traps.md`, "What a thread may not do to GitHub",
    already says so.
  - Auto mode refused, as self-modification, a widening of the stand-in's grant. The follow-up PR records this in its
    decision file (`plan/decisions/2026-11-11-second-workflow-run.md`), which is a history record, not in either notes
    file. It is a refusal a later thread can meet, so it is a trap that missed its notes file; this PR adds it to
    `docs/traps.md` so the next thread finds it.
  - The verifier's finding (a refused start leaves its item id unstartable) is a defect, and it went into a plan item,
    `fix-refused-start-poisons-item`, through the follow-up PR.
- **Blinding did not hold.** The coordinator's `MEMORY.md` state line describes this probe and asks that the observed
  item's threads not be told. `MEMORY.md` is loaded into every session in the project, and the index in snapshot 3
  dates that state to 10:08Z, so the verifier thread (started 10:08Z) and the builder after its next sync could have
  seen it. Neither thread's replies mention it.

## Result

Across both items, no builder or verifier thread wrote to memory, and the coordinator's own writes stayed directives
and state. Every trap but one went to a notes file or the ledger through the item's own PRs. The one that missed went
into a decision file instead, which is still the repo and not memory. The cheap home in this project is now the repo:
none of the three observed threads so far used memory as a lab notebook, though before 9 Nov about 98 of 147 memory files were such
logs.

Two limits. The second item was not blind, because the coordinator wrote the probe into the memory index that every
session loads; a later probe that needs blind threads keeps its notes out of `MEMORY.md`. And a snapshot sees only
what the store holds when it syncs.
