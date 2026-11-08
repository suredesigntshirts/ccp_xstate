# Refine round 7: what a fresh verifier had to dig for (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 7 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

## 1. The verifier's side of the path

Round 6 tested the builder's path on a fresh reader. This round asked a fresh headless session, given a clean clone at
main cb2456a8, to verify the build PR of `fresh-reader-gaps` and list where the instructions fell short. The gaps worth
a line, and their answers:

| Gap | Answer, in `docs/gates.md` |
|---|---|
| The local gate run names variables but not their values | `BASE_SHA=origin/main PR_BODY='Item: <id>'` at the checkout's HEAD |
| Does a `world` result name a test | No: the gate asks a `test` only of `verifier` and `builder` lines |
| Which sha a `ci` line cites, when the verdict commit makes a new head | The checks at `verified_sha`; they run again on the verdict commit |
| What `model` holds | The verifier's own model id |

The round 6 verifier also noted that step 2 of `plan/README.md` says the first commit always sets `done_on`, while the
plan check asks it only of an item naming a module. Step 2 now says so.

Left out: how a verifier finds its own session URL (the platform's), the brief's "what not to read" when a brief has
none (step 3 already says the builder's tests), and the item's stale prose (the builder's to keep).

## 2. Lines

The entry texts sit at the 225-line budget's limit, so each added line is paid for: the gate's bullets fold the builder
fields and `observations` into the test bullet, step 2 is rewritten in three lines, and `plan/README.md`'s folder listing
drops its line for the README itself, which the reader is already reading.

## 3. A suite that pinned a sentence

`verify/fresh-reader-gaps/fresh-reader-path.test.mjs` matched step 2's exact sentences, so this round's wording would
turn it red. Its two step-2 checks now look for what step 2 says (the first commit sets `done` and `done_on`; nothing is
written under `verify/<id>/`; a verifier is asked for) rather than the sentence, as round 1 decided for rule texts
(Evans: frozen language). The item names the file.
