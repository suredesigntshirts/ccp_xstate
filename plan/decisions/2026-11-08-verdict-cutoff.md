# verdict-cutoff-at-verified-sha: where the cutoff and the done_on rule live (2026-11-08)

Claude's two-way-door choices as stand-in for the person, made when readying `verdict-cutoff-at-verified-sha` from
the gap and decision 3 in `plan/decisions/2026-11-08-verification-contract-build.md`.

## 1. The verdict gate compares the contract at verified_sha with the head's

The freeze sees only a PR's base and head. The verdict gate already reads `verified_sha`, so it reads
`plan/items/<item>.md` there too and compares `contract()` of both, the same function the freeze uses. A difference
is refused with the item id and the fields that moved: the head keys whose values differ, and `Verifier brief`. An
item file missing at `verified_sha` is refused too. `status` and `done_on` stay outside the comparison, so a build
that merges main after its verdict, with a done or doing status change in it, still passes.

Not adopted: refusing in the freeze when a replan from main touches an item whose build branch holds a verdict. The
freeze cannot see the build branch, and the verdict gate is where a stale verdict would be used.

## 2. A set done_on moves only in a replan with a `## Done on change` section

The freeze gate reads every item whose `done_on` is set at the base. When the head's differs (another date, or
none), it refuses unless the PR is labelled `replan`, changes nothing outside `plan/`, and the item at the head has a
`## Done on change` section whose text differs from the base's: the replan says why there, as a contract change does
under `## Contract change`. Setting `done_on` where it was absent stays free, so done replans pass as now.

The rule lives in the gate, not in `plan/check.mjs`: `check.mjs` reads one tree and cannot tell a set date from a
moved one. `plan-reader-effort` is changing `check.mjs` in parallel, which is a second reason to stay out of it.

## 3. Docs: one sentence each in docs/gates.md

`docs/gates.md` gets the cutoff as part of the verdict checks and the `done_on` rule in "The contract freeze".
`plan/README.md`'s one sentence per rule already holds ("changes once, then freezes"), and the three entry texts have
three lines of their 230-line budget left, so the README is not changed. `docs/language.md` gains `done_on change`.
