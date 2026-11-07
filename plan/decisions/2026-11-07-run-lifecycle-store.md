# Run lifecycle store: what changes and what stays (2026-11-07)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `run-lifecycle-store`
(research `plan/research/design-books-cleanup.md`, finding 4; the person's go for all eight cleanup items, 7 Nov).

## A structural change, not a behavioural one

The research suggested two things that would change what agents read and when runs fail: one generic
"run is <state>: <what to do>" message for every "already X" refusal, and one shared attempt number across result
refusals, send-backs and stall blocks. Both are left out.

- **Messages.** Every refusal text is in the catalogue and pinned by done items' verify suites. A generic message
  would change model-facing text without evidence that agents act better on it. The store holds one table of which
  catalogue entry each hook answers in each state, so a later item can change the wording in one place.
- **One number.** Stall blocks happen before an agent exists; refusals and send-backs after. One shared count would
  let a slow-to-start session spend the builder's refusals, and it changes when runs fail. The three limits stay
  (10, 1, 2), declared once in the store's `BUDGET`, and `run.json` counts each kind. That removes the journal
  re-reads and the three scattered constants, which is the duplication the research pointed at.

CLAUDE.md's rule that a cleanup changes structure, not behaviour, decides both.

## Where things go

- `packages/engine/src/run/` holds the store and the three split modules. `actors.js` stays as the module every
  importer already uses: it keeps preparing, spawning, binding and delivering, and re-exports the rest, so the
  plugin, the inspector, bench and the done verify suites import the same names from the same path.
- Run-folder files keep their names (`spawn.json`, `agent.json`, `result.json`, `failed.json`, `sent-back.json`).
  The inspector and committed evidence read them; the store reads the state from them instead of a new state file,
  so no old folder needs migrating.
- `run.json` gains `attempts` only once an attempt is spent, so a prepared run's `run.json` is byte-identical to
  main's. A run.json without `attempts` counts from its journal rows, as today.

## Considered

- A `state.json` file per run: a second record of what the files already say, and a migration for every old folder.
- Moving the hooks into the store: the store would then know result schemas, GitHub and stage contracts, which is
  the mixing the split is meant to end.
