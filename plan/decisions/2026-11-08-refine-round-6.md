# Refine round 6: what a fresh reader still had to guess (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 6 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

## 1. Test the texts on a reader before trimming them again

Rounds 1 to 5 judged the texts by reading them. This round asked a fresh headless session, given a clean clone at
main 6bd859a4, to build the ready item `pinned-fetch-temp-repo` and list where the instructions were unclear. It walked
the path correctly. The gaps it named, and the answers this round writes down:

| Gap | Answer, and where it goes |
|---|---|
| Who starts the verifier | Not the builder: it asks whoever started it. `plan/README.md`, step 2 |
| Which date `done_on` takes | The day of the build PR's first commit (round 4 accepted this). Step 2 |
| Is `done` before the verdict a contradiction | The PR cannot merge until a verdict proves it. Step 2 |
| Does the builder write under `verify/<id>/` | No. Step 2 |
| Why `node --test verify/<d>/` fails | node 22 takes a bare folder as one file; name the files. `CLAUDE.md`, Commands |
| Where the release row goes | Nowhere the thread must put it; the sentence leaves `docs/gates.md` |

Reading the release step also showed `plan/README.md` and `docs/gates.md` listing `plugins/harness/` and
`packages/journal/` as what is released, while `RELEASED` in `scripts/release/release.mjs` also carries
`packages/engine/src`. The texts now point at `RELEASED` (Pragmatic Programmer: DRY), and step 4 points at the release
command instead of restating its rule.

The entry texts' budget drops to 225, their length once these lines are in: the lines added replace lines removed.

## 2. Not taken

- The out-of-date harness notice: what a thread does when its session runs an older release belongs to the plugin's
  README, not the plan path.
- The item's stale sentence about `verify-regression-set`: item prose is the builder's to keep, not a rule text.
