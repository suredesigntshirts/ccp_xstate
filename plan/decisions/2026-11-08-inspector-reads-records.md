# Inspector reads records: what the engine exports and what the page stops showing (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `inspector-reads-records`
(research `plan/research/design-books-cleanup.md`, finding 6; the person's go for all eight cleanup items, 7 Nov).

## The engine explains an event; the exporter only shows it

`packages/engine/src/explain.js` exports `explain(spec, snapshot, event)`: the transitions the engine tries for the
event, in its order (deepest active state first, each state's transitions in file order, up to the first whose tests
hold), each with its JSON pointer, guard, the needs of the state it enters and the tests that fail. It is built on
`chart()` and on one function in `spec.js`, `failingOf(spec, transition, target, scope)`, which the machine's bound
guard also calls. So the guard the engine runs and the explanation the page shows are one code path: a change to how
the engine binds needs changes both.

`chart()` gains, on each transition only (not on its writes, so no stage record changes): `def` (the transition as the
file holds it), `delay` for an after, and `invoke` and `on` ('done' or 'error') for an invoke's onDone and onError.

The page's map is drawn from `chart()` too: its states from `chart().nodes`, its ways out from `chart().transitions`,
each named by its JSON pointer. The exporter's own walker (`graphOf`, `matchEdge`, `candidatesOf`, `listenersOf` and
its copy of the set actions) is deleted.

The engine's load check refuses a root `on`, `always` and a state's own `onDone` (checked 8 Nov: a root `on` is
refused at load, "the harness does not read" it), and its targets are sibling names. So on, after and an invoke's
onDone and onError are every transition the engine runs, and `explain` covers them all. The exporter's support for
`#id` and `.child` targets, eventless transitions, joins and parallel states served tournament lane engines only.

## Prompt provenance and model runs come from the stage record

Every committed model run folder has `stage.json` (checked 8 Nov over every `runs/*/prompt.md` and `brief.md` in the
repo). So:

- A run is a model run when its run folder has `stage.json`, the record the engine writes for every model stage run.
  Not when it has a prompt file.
- The prompt's coloured segments are `stage.json`'s pieces in part order, each labelled from its recorded source
  (frame, workflow pointer or stage file line, input). The text between pieces is the frame's part headings and line
  breaks, labelled as the harness frame. Added context is the record's `context` piece.
- Fields the host wrote on a stored result are `stage.json`'s `stamped` paths.
- Who wrote the prompt is read from the Task pieces' producers, as it already is for a stage-contract run.

Deleted: the string-literal scanning (`stringPieces`, `piecesOf`, `labelGap`, `runValuesOf`, `segmentsOf`,
`jsonChunks`), the template-code display (`sourceOf`, `withHelpers`), the host-field guessing (`hostFieldsOf`,
`stampOf`, `schemaDifference`), and the passthrough, template and template+workflow provenance kinds, with the page
code that shows them.

## The cutoff: runs without a stage record are not shown

The research said the exporter "stops supporting runs recorded before stage.json". A journal root whose model run
folder (one with a prompt file) has no `stage.json` is refused by the exporter with that reason, and the build skips
it by name, as it skips a missing source. An engine checkout without `explain.js` is refused the same way.

That drops from `scripts/inspector/sources.json`:

- the four October journals in the shared folder (first real issue, toy run, actor returns, item views), replayed on
  main at 36da3e4, and the `commit:36da3e4…` engine;
- lanes A and C of the design tournament (scratch-repo checkouts under `/home/user/lanes`, absent on most machines).

They stay readable where they are; the inspector just doesn't render them. Build's `{ commit }` engine form stays: it
works for any commit from this item on.

## Done suites this changes

- `verify/inspector-stage-record/older.test.mjs` asserts that the October journals render on the head as on main. It
  runs only where the shared folder and both commits exist (it skips in CI), and this cutoff retires the line it
  proved. It is deleted; its verdict stays as the record of that item.
- `verify/workflow-inspector/` tests that need lane checkouts already skip without them, and stay unchanged. Its
  grep test (no state, actor or workflow name in `scripts/inspector/`) must still pass.
- `verify/harness-glossary` (`notes.test.mjs` reads the exporter's source; `v1.test.mjs` exports a v1 bench run),
  `verify/wf-intake/inspector.test.mjs`, `verify/inspector-stage-record/true-to-record.test.mjs` and `flow.test.mjs`
  and the stage bench tests must pass unchanged: those runs all have stage records.
- `scripts/inspector/test/` is the builder's own and is rewritten for the new reading.

## Out of scope

- The page's layout and the Stage view stay as they are; only the parts fed by deleted guesses change.
- Republishing the Inspector artifact: the refresh of all project artifacts after the eighth cleanup item does that.
- The live capture's trace reading (`outcomeOf`, `resumeNote`) reads capture rows, not engine decisions, and stays.
