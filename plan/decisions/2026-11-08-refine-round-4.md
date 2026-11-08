# Refine round 4: an item is done in its build PR (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 4 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

## 1. Done moves into the build PR

Every item took three PRs: a readying replan, the build, and a done replan whose content is a status flip and a
`## Done` paragraph repeating what git and `verify/<id>/` already show. Main never held `doing`: the build PR's first
commit set it, and the done replan replaced it. So the build PR's first commit now sets `done` (and `done_on` when the
item names a module), and the verdict gate makes that true: the PR cannot merge without a complete verdict from a
session that wrote nothing else. A forgotten done replan, an item open on main after its merge, and one more CI wait
per item are errors defined out of existence (Ousterhout); the status no longer repeats the verdict in a second PR
(Pragmatic Programmer: DRY).

No gate changes: the freeze gate already leaves `status` and `done_on` out of the frozen contract, and the verdict
gate already refuses any commit after `verified_sha` outside `verify/`, which is why `done` goes in the first commit.
A test keeps that path open.

`done_on` is now the day the build started rather than the day it merged. The fix budget counts done fixes within 14
days, so a build that ran over days counts a little longer. Accepted.

## 2. Reader effort is read, not stored

`plan-reader-effort` made the done replan paste `node scripts/reader-effort.mjs <pr> --json` into the head. The
numbers count the verifier's tests and evidence, so they exist only after the verdict, which is after the last commit
a build PR may make outside `verify/`. They are also a derived number stored back, which the glossary rules out for
the journal ("a number computed from rows, never stored back"); the same holds for git. The item's PR is already in
git: the first merge on main's first-parent line whose change sets `plan/items/<id>.md` to `done`. So
`reader-effort.mjs --item <id>` reads it there, and `plan/check.mjs` stops asking for the field. Heads that recorded
it keep it, and the schema still checks its shape. What `plan-reader-effort` wanted, every built item's cost being
visible, holds for every item at once instead of for those whose done replan remembered (Ousterhout: define errors
out of existence; Pragmatic Programmer: DRY).

Two done-suite tests of `plan-reader-effort` leave with this item, named in its outputs: the plan check refusing a
verified done build item without the field, and the README's done step naming it.

## 3. What a done replan carried

Verifier observations sometimes ended "for the done replan". Observations never gate; one worth acting on becomes a
draft item or a line in the next round's decision file.

## 4. Left for later

- `doing` stays a valid status for builds already open; once none is, a later round takes it out of
  `item.schema.json` (the schema is being changed by `plan-reader-effort` and `item-head-trim` now).
- The readying replan stays: the contract is read and checked before a build starts (ledger L-plans-need-independent-read).
- The engine README's length belongs to `actors-module-seam`.
