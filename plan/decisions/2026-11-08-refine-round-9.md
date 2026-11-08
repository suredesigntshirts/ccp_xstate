# Refine round 9: what a fresh item writer had to dig for (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 9 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

Rounds 6 and 7 tested the build and verify paths on a fresh reader. This round asked a fresh headless session, given a
clean clone at main 1c0c9cdd, to turn a one-line idea into a ready item and list where it had to guess. Taken:

| Gap | Answer |
|---|---|
| Which fields a ready item needs | The schema's `readyRequired`; the plan check names a missing one. `plan/README.md`, How an item is written |
| The `reader_effort` row reads as a field to fill | It is read from git (round 4); the row leaves the table, the schema keeps its description |
| "Depends on no later stage" lives only in code | `plan/README.md`, To add an item |
| `CLAUDE.md`'s "four steps from ready to done" though step 1 readies | "the four steps to done" |
| The sha rule refuses words made of a to f, such as "defaced" | A sha holds a digit; `SHA` asks for one (Ousterhout: define errors out of existence) |

A run of seven or more hex letters with no digit is a word far more often than a short sha (this item's first draft was refused for naming one in an Expect line) (the odds a 7-character sha
has no digit are about 1 in 400), and an item that pins main with such a sha is still read by the verifier.

Not taken: copying the `PINS` words into the README (a second list; the README names `PINS` in `check.mjs`), a rule to
search for an existing item first (judgement, not a rule), the order of commit trailers (no gate reads it), and the
`step_back` wording, which the README and schema already agree on.

The entry texts stay at 224 lines: the two added lines are paid for by the `reader_effort` row and a shorter To add
an item line.
