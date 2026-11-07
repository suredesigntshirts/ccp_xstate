# Stage contract declares rules: the marks and what stays (2026-11-07)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of
`stage-contract-declares-rules` (research `plan/research/design-books-cleanup.md`, finding 5; the person's go for all
eight cleanup items, 7 Nov).

## Three marks, one reader

The research proposed `"x-verdict": true`, `"x-store": "brief"` and `"x-ref": "<kind>"`. The contract uses:

- `"x-verdict": "<value>"`: the value that means the check passed, not `true`. Knowing which value passes is what the
  accept-time cover check needs; `true` would leave the engine guessing it from the word PASS again. The same mark on
  a covered entry's `result` says which entries pass.
- `"x-brief": true` instead of `"x-store": "brief"`: the engine stores only briefs, and a second store kind would be a
  new rule, not a value of this one. The role is the field's name, as `brief.stored` rows have it today.
- `"x-ref": "github-pr" | "web-page"`, as proposed.

`marks.js` is the one reader. The load check, the cover check and accept ask it; none of them reads a mark, an actor
name, a verdict word or a url themselves.

## A stage without marks reads as main

Every committed journal pins its workflow's bytes, every run folder holds its stage schema, and many tests build
specs inline. None carries marks. Rather than migrate them, a stage with no mark anywhere is read by one function in
`marks.js` that reproduces main's guesses exactly (the stage named `brief`, the words PASS and FAIL in any case, a PR
url). That keeps in-flight items on their rules and keeps the tests that pass on main passing, which CLAUDE.md's
cleanup rule asks for. `retire-pinned-legacy` decides when the reading can go.

The marker is per stage, not per workflow: a run folder holds only its stage, so the reading must be decidable from
it. A stage with at least one mark is read only from its marks.

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

- Inferring nothing for unmarked stages and marking every inline test spec: rewrites hundreds of test specs and every
  pinned blob's meaning; refused by the cleanup rule.
- A workflow-level `meta.marks` version: run folders do not carry `meta`, so accept could not tell.
- Moving the stamped-field recognition in nodeAt, chosen and hostSet to `x-ref`: unmarked stages still need the shape,
  and in a marked stage the load check makes shape and mark agree, so it would add a second path for the same answer.
