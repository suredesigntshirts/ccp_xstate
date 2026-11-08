# Refine round 10: what a fresh builder had to guess after the verdict (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 10 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

Rounds 6, 7 and 9 tested building, verifying and writing an item on a fresh reader. This round gave a fresh headless
session a clean clone at main 60a2760f and asked what a builder does once a verdict lands: all MET, one NOT MET, a
red test it did not touch, and whom it tells. Taken:

| Gap | Answer |
|---|---|
| What a NOT MET verdict sets going | The builder pushes a fix and asks its starter for a verifier again; the next `verdict.json` replaces the last. `plan/README.md`, step 3 |
| "round" (in `step_back`) is never defined | One build push and the verdict on it. `docs/language.md`, Plan |
| "starter" is never defined | The session that started the thread, which hears its asks: the coordinator, or the person. `docs/language.md`, Platform |
| The merge method is unstated | A merge commit, as the engine's merge effect makes. `plan/README.md`, step 4 |
| Whether merging main in keeps the verdict; the verdict row says "at the head sha" while the gate allows later merges | It does; the row says "for the head (below)", pointing at the checks that define it |
| Whom the merging thread tells | Its starter, with what the release command printed. `plan/README.md`, step 4 |
| `plugins/harness/README.md` names two of `RELEASED`'s paths; the release script's skip reason names three of four | Both name `RELEASED` instead of a copy of it (one rule said once); the script's comment loses its item id |
| A red test the PR did not touch | One re-run of the check; red again, it is a real failure. `docs/traps.md` |

Not taken: changing the contract after a NOT MET verdict (the README and the freeze gate already agree it is refused
once a verdict file exists), defining `ci` and `verdict` earlier in `plan/README.md` (it points at `docs/gates.md`,
whose first table names them), and the merge-of-main case in more words (the gate's own list says it).

The entry texts go from 224 to 223 lines: the two lines steps 3 and 4 gain are paid for by `docs/gates.md` folding its
local-run paragraph into its first, which drops its second copy of "A PR names its item only by an `Item: <id>` line"
(`plan/README.md` keeps it) and the builder-not-enforcing clause (`plan/README.md`, How slop is kept out, says it),
and by `plan/README.md`'s opening saying in two lines what it said in three.
