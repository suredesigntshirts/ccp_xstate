# Which open items can run at once, and the dependencies that say so (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, made when the person asked whether items that touch
different subsystems could be built in parallel. Running at the time: `verify-regression-engine` (#199, in
verification), `rules-said-once` (#202, in verification) and refine round 2 planning.

## 1. A dependency names an item whose files or rules this item changes

`depends_on` already orders items by what they need. Four drafts edited files that `rules-said-once` or
`test-fixture-edges` change, without saying so, so `--order` would have shown them as ready to start beside those
items. Added:

- `verdict-cutoff-at-verified-sha` after `rules-said-once`: both change `scripts/gates/pr-gate.mjs` and its tests,
  and `rules-said-once` changes how the verdict gate finds the PR's item (the `Item:` line only), which is the item
  this one reads at `verified_sha`.
- `evidence-gate-edges` after `rules-said-once`: both change `scripts/gates/pr-gate.mjs`, `plan/README.md` and
  `docs/gates.md`, whose sections `rules-said-once` rewrites.
- `verify-regression-plugin` after `rules-said-once`: `rules-said-once` deletes the CLAUDE.md test in
  `verify/harness-glossary/notes.test.mjs`, one of this item's 19 suites, so its table classifies the suite as that
  build leaves it.
- `verify-regression-set` after `test-fixture-edges`: `test-fixture-edges` edits
  `verify/self-update-by-version/no-self-edit.test.mjs`, one of this item's suites, so it moves the fixed test.

## 2. Two items that share a source file run one after the other

A shared file that is not a dependency is a scheduling rule, not a plan field: `verdict-cutoff-at-verified-sha` and
`evidence-gate-edges` both change `scripts/gates/pr-gate.mjs`, so the second starts when the first merges.
`actors-module-seam` rewrites the imports of about 51 engine files, so it starts when no other engine item is open.

## What can start now

`test-fixture-edges` (`test/setup.test.mjs`, `verify/self-update-by-version/`, `scripts/debug/trace-writes.mjs`,
`plugins/harness/test/capture.test.mjs`) and `plan-reader-effort` (a new script, `plan/check.mjs`,
`plan/item.schema.json`) touch nothing the running items touch. `plan-reader-effort` leaves `plan/README.md` alone
until `rules-said-once` merges.
