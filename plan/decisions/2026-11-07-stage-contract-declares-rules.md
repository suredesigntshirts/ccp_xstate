# Stage contract declares rules: the marks and what stays (2026-11-07)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of
`stage-contract-declares-rules` (research `plan/research/design-books-cleanup.md`, finding 5; the person's go for all
eight cleanup items, 7 Nov).

## Marks in meta.marks, one reader

The research proposed marks on the output fields (`"x-verdict": true`, `"x-store": "brief"`, `"x-ref": "<kind>"`), and
the first ready contract kept that shape. Building it showed the cost: a run folder stores its stage's schema, the
stage record prints the Schema line, and done suites (run-lifecycle-store, fix-waiting-lines-owner, stage-prompt-files,
engine-stage-contract) assert those equal main's. Changing them would edit other items' assertions, which the cleanup
rule and fix-blocked-retry's decision 9 do not allow.

So the marks sit beside the stages, in the workflow's `meta.marks`, one entry per model stage:

- `verdicts`: `{ "<path>": "<value>" }`, the value that means the check passed, not `true`. Knowing which value passes
  is what the accept-time cover check needs; `true` would leave the engine guessing it from the word PASS again. A
  covered list's entries are `"<list>.0.result"`.
- `briefs`: `["<field>", ...]`. The engine stores only briefs, so a store kind would be a second rule, not a value of
  this one. The role is the field's name, as `brief.stored` rows have it today.
- `refs`: `{ "<path>": "github-pr" | "web-page" }`.

A path is field names joined by dots, `0` for any list entry. `meta.actors`, the stage files and every prompt stay as
on main; only the workflows' pinned hashes move, and done suites' snapshots of those are re-captured (decision 9).

Accept reads a run's marks from the workflow blob the run was prepared from (its `run.json` `workflow` pin), so
`run.json` does not change. `marks.js` is the one reader: the load check, the cover check and accept ask it; none of
them reads an actor name, a verdict word or a url themselves.

## A stage without marks reads as main

Every committed journal pins its workflow's bytes, and many tests build specs inline. None carries marks. Rather than
migrate them, a stage with no `meta.marks` entry is read by one function in `marks.js` that reproduces main's guesses
exactly (the stage named `brief`, the words PASS and FAIL in any case, a PR url). That keeps in-flight items on their
rules and keeps the tests that pass on main passing. `retire-pinned-legacy` decides when the reading can go.

The marker is the entry itself: a stage with an entry, even an empty one (feature's brief, intake's shape), is read
only from its marks, so no repo stage takes the old reading.

## Research sources are web pages

`research.json`'s `ref` is marked `web-page`. On main a source whose url is a GitHub PR was checked as a PR (its `at`
against the head sha), which a quoted text never matches. Declared, it is checked as a page. This is the one
behaviour change for the repo workflows, and it is the declared intent of the field (`at` is the quoted text).

## Where the checkers live

`packages/engine/src/refs/`, not `effects/refs/` as the research suggested: in the glossary a host effect is an actor
the host runs (merge, ask, post), and a ref checker is not an actor. Each module exports `kind`, `stamps`, `hidden`
and `check`; `STAMPED` and `HIDDEN` are the union, in main's order, so the reserved refusal lists fields as before
and a stamped result's bytes, and its blob hash, are unchanged.

## Considered

- Marks inside the output schema (`x-verdict` and so on): closest to the fields, but changes stored schemas and
  Schema lines that done suites assert (above).
- Inferring nothing for unmarked stages and marking every inline test spec: rewrites hundreds of test specs and every
  pinned blob's meaning; refused by the cleanup rule.
- Moving the stamped-field recognition in nodeAt, chosen and hostSet to the marks: unmarked stages still need the shape,
  and in a marked stage the load check makes shape and mark agree, so it would add a second path for the same answer.
