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

### 2. The next item built after this one

To be added when it merges. Its builder and verifier threads are not told about this probe.
