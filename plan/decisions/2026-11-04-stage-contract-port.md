# Porting main's tests to the stage contract (2026-11-04)

Plan item `engine-stage-contract`. Two-way doors decided while landing lane S
([tourney/2026-11-04-stage-contract/S-cleanup](https://github.com/suredesigntshirts/ccp_xstate_scratch/tree/tourney/2026-11-04-stage-contract/S-cleanup)
at c62f5ac) on main. The why of the design is `2026-11-04-adopt-stage-contract.md`; this file records what the port
itself had to decide.

## The lane applied as is

The lane's diff from its base (main 5633401 plus the tournament kit) applied to main without a conflict: main's
`packages/engine`, `workflows/` and `docs/journal.md` had not moved since. Every file the lane touched is byte for byte
the lane's at c62f5ac except `packages/engine/src/standin.js` and `packages/engine/src/index.js` (below). The tournament
record is left to `tournaments/2026-11-04-stage-contract/` as PR #72 (tournament-scoring-floors) landed it; this item
adds only `trials/adopt/` there.

## Behaviour lane A removed, and the tests that guarded it

Lane A of the 2026-11-03 tournament (the base of lane S) took these out of the workflows, on purpose
(`A-minimalist/design.md`, "Removed"): the build timeout and every `after` timer, the `tripwire` event, `pr.pushed`
(a push is now CI green on the PR at its new head), `inc` (a bounded loop is the `built`/`rebuilt` shift register),
`below` in quick-fix's guards, and `reenter` (a replan tap with no written why matches no candidate, so the host refuses
it and the card stays open). The engine still runs timers, tripwires and `below` for any workflow that declares them.
So the tests of that machinery were not deleted: they run on a fixture workflow,
`packages/engine/test/fixtures/workflows/timed.json`, and the tests of quick-fix's old behaviour were ported to its
new behaviour. No test was deleted without a named replacement; the PR body lists every one.

One gap's test was deleted because the gap is closed: `verify/parity-cases/C-builder-cannot-change-own-workflow.gap.test.mjs`
characterised "no workflow hash is journalled". Lane A's pin journals `quick-fix@<sha256>` and restores from the stored
bytes, so the case holds; its parity test `packages/engine/test/parity/C-builder-cannot-change-own-workflow.test.js`
replaces the gap test and its `gaps.json` entry is removed. **fix-workflow-pinned is met by this item** and needs a
replan to `done` (its own Expect lines were never checked separately).

The #110 journal (`packages/engine/test/fixtures/110-demo/`) was recorded on the pre-contract quick-fix and cannot
replay on this engine: an item pinned to a pre-contract workflow is refused at load by design (tourney S3 (C)). The
wf-quick-fix verifier's replay test now asserts exactly that, and its replay checks run on #110's path recorded on
today's quick-fix.

## Two engine fixes the port found

- **Stand-in grants never matched.** `standin.js` compared a grant's `workflow` with the item's spec id, which the pin
  made `quick-fix@<sha256>`, so no grant naming `quick-fix` (the form `grants.json` uses) covered any answer. A grant
  now covers its workflow by name, or one pinned version by its id.
- **A pinned item whose root never stored the blob could not be run.** `loadWorkflow('name@<sha256>', { root })` now
  stores the bytes from `workflows/<name>.json` when the blob is missing and the file hashes to exactly the pin. The
  hash is checked either way, so an edited file is never taken (`packages/engine/test/pin.test.js`).

## What would reverse this

The same as the adoption decision. The timed fixture goes if the engine drops timers and tripwires entirely (lane A's
"can be deleted in a follow-up"), with their host code.
