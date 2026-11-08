# Retire pinned legacy: the cutoff and what goes (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `retire-pinned-legacy`
(research `plan/research/design-books-cleanup.md`, finding 7; the person's go for all eight cleanup items, 7 Nov).

## The cutoff is met now

The research set the cutoff as "every engine item in the project journal finished or dropped". Checked on 8 Nov:

- The project journal, `/mnt/project-files/harness/journal` (the plugin's `harnessDir`), has no `items/` folder: no
  engine item was ever started in it. Its `sessions/` and `blobs/` hold hook captures and pinned bytes only.
- Every engine item that ever ran sits in a trial root under the shared folder (`first-real-issue/`, `toy-run/`,
  `toy-run-returns/`, `toy-run-views/`) or in a committed journal in this repo (`bench/`, `tournaments/`). Three of
  the eleven trial items reached `done`; the other eight stopped where their trial or probe thread ended
  (`awaitingMerge`, `briefing`, `replanning`; `fri-jsonl-lint` was redone as `fri-jsonl-lint-2`, which merged). This
  decision drops those eight: they are evidence, and nobody advances them.

So the cutoff is today, and no release has to keep running an item pinned to an older format. An item pinned to one
is finished on the release that started it.

## Records stay readable; only running is refused

Committed journals are evidence that done items' suites read: `test/journals-replay.test.mjs` replays every one,
verify/trial-fail-path, verify/stage-bench and the stage bench read the adopt trial, whose pinned quick-fix predates
the asking timer. Refusing those pins at load would break reading history, which is not what the cutoff is about.

So the line is drawn between reading and running:

- `loadWorkflow` of a pin reads the hash-checked blob and runs the current load check on it, with no relaxation. When
  the check refuses it, the spec still loads, marked retired with the check's message, so `restore` replays it and
  readers render from it.
- The host refuses to advance an item whose workflow is retired: `applyEvent` turns every event away as refused,
  saying the item's pin, why the engine no longer runs it, and to finish it on the release that started it (the
  release on its seq-0 row); `runEffects` runs nothing, so no run of it starts. `accept` does not check the workflow:
  a result from a run an earlier release prepared goes nowhere, because the event that would deliver it is turned
  away. That keeps accept free of the engine's loader (the installed plugin bundles no xstate) and the message
  catalogue unchanged (verify/prompt-catalogue requires every entry be reached by its fixed runs); the reason is a
  host row's, inline like the host's other turned-away reasons.
- `checkStages` loses its `pinned` option. Its pre-contract refusal no longer talks about pins: a pin that old is
  retired like any other, and for a workflow loaded by name it is the plain "is not a stage, a host effect or a
  workflow".

One check, one rule: a workflow the engine would refuse to pin today is one it no longer runs.

## The unmarked reading in marks.js stays, for now

`stage-contract-declares-rules` left a stage without `meta.marks` read as main read it, "until retire-pinned-legacy
decides". Measured on 8 Nov by deleting that reading and running `npm test`: 259 failures. After separating reading
from running, these still fail, all in done items' frozen suites, on assertions rather than snapshots:

- verify/stage-contract-declares-rules (unmarked-as-main, declared-rules-hold): they assert the reading itself;
- verify/stage-prompt-files/files.test.mjs: loads main's pre-stage-file quick-fix JSON by name, whose verify guard
  reads `result` as a PASS/FAIL verdict;
- verify/prompt-catalogue/same-text.test.mjs: calls `coverGap` without marks and expects covers-disagrees.

fix-blocked-retry's decision 9 lets an item re-capture other items' snapshots, never their assertions. So the reading
is no longer a compatibility path for items (every repo stage is marked, and any pin a release refuses is retired),
but it is still the engine's reading of an unmarked spec, which those suites pin. Removing it is its own item, with
its own decision to touch done suites: drafted as `retire-unmarked-reading`.

## Out of scope

- The inspector's pre-catalogue and pre-`stage.json` paths go in `inspector-reads-records`, which rewrites the
  exporter and depends on this item for the cutoff.
- A workflow file with no stage files is pinned as its own bytes (`prompts.js`). That is a current format, used by
  every test that writes a workflow inline, not a pinned-legacy path; its comment is rewritten in the present tense.
- Reading old records stays: the journal's v1 upcaster, `promptFile`'s brief.md for run folders written before journal
  v2, and run/store.js counting a run.json without attempts from the journal.

## Considered

- Refuse old pins at load: one branch fewer, but every reader of committed evidence would need the release that wrote
  it, as the inspector does for the first real issue; done suites read them on the head.
- Require marks for every model stage at load: makes every unmarked inline spec and every committed pin refused;
  ruled out with the unmarked reading above.
