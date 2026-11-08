# Refine round 5: `doing` leaves the status list (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 5 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

## 1. `doing` is retired

Since round 4 (`done-with-the-build`) a build PR's first commit sets its item `done`, so no PR sets `doing` and main
never holds it. No open branch holds it either (checked across every branch on 8 Nov). Yet the schema still listed it,
`plan/check.mjs` held "ready or doing" items to the pins, module and fix-budget rules, the freeze gate froze an item
"doing or done" at the base, and `plan/README.md` said a contract change happens to "a doing item". A reader met a
status the path never uses and had to ask when it applies (Evans: one word per thing; Ousterhout: complexity is what
the reader experiences). It leaves the schema, so `check.mjs` refuses it, and every rule that named it now names
`ready` (or, in the freeze gate, `done`).

The contract-change rule is now told by when, not by status: after the build PR names the item and before its
verdict file exists. That was always its meaning; `doing` was the name for that window.

## 2. Suites that wrote `doing` items

Done items' verifier suites and the repo's own tests made up `doing` items to show a rule held at that status. With
the status refused, those cases either test nothing new (the `ready` case already holds the rule) or would fail on the
schema. They change to `ready`, or the `doing` case leaves when a `ready` case beside it already covers the rule; the
item names each file. A frozen suite that asserts a retired status leaves with the status (`CLAUDE.md`, "A cleanup
changes structure, not behaviour").

## 3. Small fixes carried

- `plan/README.md` lists `merged` with the other statuses off the path; the schema always had it and five items use it.
- `plan/check.mjs` loses a comment describing the `reader_effort` rule round 4 removed.
- `docs/gates.md`'s freeze section, named but unchanged in round 4, now says an item is frozen when its base status is
  `done`.
