# Refining the brief stage: candidates, criteria and cases (2026-11-05)

Claude's two-way-door decisions as architecture lead, made when `refine-brief-stage` went ready. They follow
`plan/decisions/2026-11-05-prompt-refinement.md` and the refinement procedure in `docs/prompts.md`.

## Where the baseline fails

`bench/brief/reports/baseline.md` (7 cases, k = 3, 21 runs). The form holds in every run: returned, changes-nothing,
one-check-per-line and no-restated-rules are 21 of 21. The judged criteria are not:

| Criterion | Met | What fails |
|---|---|---|
| words-only | 6/21 | PASS conditions add an exit status, exact output or a format the line does not ask for |
| runs-as-written | 14/21 | Commands that cannot run, most often regexes broken by bash double quotes (real-adopt-clamp 0/3) |
| catches-traps | 14/21 | The after-merge line is checked on the live page (0/3); the missing CSV line (1/3); the vacuous workspace test run (1/3) |
| avoids-must-not | 12/21 | The live-page check (0/3); stricter conditions on the clamp case (0/3) |

The brief file has not changed since the baseline ran: its rendered prompt for a case is byte for byte the baseline
run's, apart from the run id. The quick-fix pin differs (39430bff to 8d046c5a) only through other stages, so the
baseline stays the base every variant is compared with.

## The candidate changes

Each is one change to `workflows/quick-fix/brief.md`, run as its own variant of the baseline file on every case at
k = 3 with the baseline's model, and compared with the baseline. A change is kept when its targeted criterion improves
and no criterion is worse, or when a trade is accepted in writing here.

1. **dry-run** (runs-as-written). A rule: before returning, run every command the briefs give, in this repository at
   its current commit, exactly as written, and fix any that fails because of the command itself; a command that fails
   only because the change is not built yet is expected to fail. This is the outcome's "every check command dry-run
   before the brief is fixed", and the one habit the baseline shows is stable (the adopt trial's real brief had the
   same broken regex).
2. **proof-at-head** (catches-traps and avoids-must-not on after-merge and the intake cases). A rule: check each line
   at the pull request's head, by its proof kind when `issue.proofs` gives one (run: run it; ci: read that check; read:
   read the file); a line only visible after merge (a deploy, a published page, a release) is checked by what the head
   contains that will produce it, and the check says so. The `issue` input's meaning names the fields intake adds.
3. **words-test** (words-only). The words-only rule rewritten as a test the writer can apply: for each PASS condition,
   could a pull request meet the line's words and still fail it? If so, the condition is stricter than the line;
   loosen it and put the stricter test under Advisory. An exit status, exact output, exact message or format is
   stricter unless the line names it.
4. **criteria-not-methods** (builder-criteria and methods-private, research finding 2). A rule: the builder brief
   opens with the expect lines word for word as its criteria, and the issue's non-goals as limits, then the steps; it
   never carries the verifier's commands or PASS and FAIL conditions. The builder aims at the bar, not at the checker.
5. **traps-named** (catches-traps on the missing-line and vacuous-test cases), run only if the step-back budget
   allows after 1 to 4. The task asks the writer to read the repository for each line before writing: where it is
   already half true, already broken, untested, or where a test run would pass vacuously, and to name each in that
   line's check and in the builder's steps.

The kept changes are then run together as one combined version, on every case at k = 3, compared with the baseline,
and given a blind read (`compare.mjs --blind`) by a fresh `claude -p` session started in an empty folder, which has
seen neither version. Changes that interact badly show up there; if the combined version loses a criterion that no
single kept change lost, the change last added is dropped and the combination run again.

## Two new criteria

The outcome asks for things the rubric does not measure yet. Two criteria are added, approved here by the building
thread as the person's stand-in:

- **builder-criteria** (mechanical): the builder brief quotes every expect line word for word. Mechanical because a
  quote is a string match; scored on all 21 baseline runs from their result files, with no model run.
- **methods-private** (judged): the builder brief carries no PASS or FAIL condition and no probe written for the
  verifier; it may tell the builder to run the repository's own tests and any command an expect line or its proof
  names. Research finding 2: give the builder the bar, keep the checker's methods to the checker, so the build cannot
  be fitted to the probe. Judged because "a probe written for the verifier" needs reading. It gets at least 2
  planted-bad outputs in the judge check, and the baseline runs are judged on it.

No criterion is added for the proof kind or for dry-running. Their effect is what runs-as-written, catches-traps and
avoids-must-not already measure, and a criterion for the means would reward the habit over the result.

## Intake-shaped cases

Since wf-intake, an issue that came through intake carries `title`, `problem`, `reason`, `outcome`, `proofs`,
`non_goals` and `assumptions` beside `url` and `expect`. None of the 7 cases has them, so at least 2 new cases do,
each written to intake's `#shaped` schema and each with a trap in its repository: one whose proofs mix run and read
with a non-goal a careless builder would cross, and one whose `how` names a command that cannot run as written at the
case commit. Each gets 3 baseline runs. The 7 old cases and their runs are left exactly as they are.

## Cost

A set is about 27 stage runs (about 15,000 fresh tokens each) and about 4 to 5 judge sessions per run. Up to 6 sets
(the new cases' baseline, 4 or 5 variants, the combined version) fit in the item's step-back budget of 9,000,000 fresh
tokens. Past it, the item steps back with what was measured rather than running more variants.

## What would change these

- If the judge check disagrees with the hand grades on methods-private, its wording changes, never the judge's answer.
- If a variant improves its target on the planted cases but loses it on the real ones, it is dropped: the real cases
  are the ones the bench exists to predict.

## After the build (5 Nov)

Decisions made while building, as the person's stand-in. Every set is 9 cases at k = 3 with claude-opus-5-5, scored
by the same judge; reports and compares are in `bench/brief/reports/`, run sets in `bench/brief/runs/`, the variant
files in `bench/brief/variants/`. Totals are runs met out of 27:

| Criterion | baseline | dry-run | proof-at-head | words-test | criteria-not-methods | dry-run-copy | combined |
|---|---|---|---|---|---|---|---|
| one-check-per-line | 27 | 27 | 27 | 27 | 23 | 26 | 27 |
| no-restated-rules | 27 | 26 | 27 | 27 | 26 | 26 | 27 |
| builder-criteria | 18 | 20 | 12 | 19 | 27 | 20 | 12 |
| words-only | 10 | 8 | 10 | 19 | 12 | 8 | 20 |
| runs-as-written | 19 | 22 | 20 | 22 | 16 | 23 | 23 |
| catches-traps | 20 | 23 | 22 | 20 | 18 | 21 | 20 |
| avoids-must-not | 18 | 17 | 17 | 24 | 15 | 16 | 24 |
| methods-private | 11 | 7 | 12 | 11 | 11 | 10 | 11 |

returned and changes-nothing are 27 of 27 in every set.

- **Judge check corrected, not the judge.** The judge failed methods-private on the 7 adopt-trial briefs that were
  hand-graded met. It was right: their README examples and throws case are check 1's and check 2's own inputs. The
  grades were corrected, `fixed-private` was added as a passing base, and the check agrees 11 of 11.
- **A case corrected.** intake-shared-parser's first must_catch asked for the word "shared"; it now asks for the
  outcome (the CSV path kept passing). One-check-per-line and builder-criteria now accept a quoted line whose double
  quotes are escaped (`\"`), which intake-suggested-fix's lines force.
- **words-test kept.** Its target, words-only, went from 10 to 19, and avoids-must-not from 18 to 24. No criterion is
  worse.
- **proof-at-head kept, with a trade accepted here.** It fixes the after-merge trap (catches-traps and avoids-must-not
  on planted-after-merge 0 of 3 to 3 of 3), the failure the baseline report named first. It costs builder-criteria
  (18 to 12) and one avoids-must-not run. Builder-criteria is new, and losing it means the builder gets lines in the
  writer's words rather than quoted. That is worth less than a verifier that can never pass a PR with an after-merge
  line.
- **dry-run dropped, and so was dry-run-copy.** Both raise runs-as-written (to 22 and 23), but each loses words-only,
  avoids-must-not and methods-private. dry-run also missed its own target case: in real-adopt-clamp the session ran a
  correctly escaped regex and then wrote it into the brief with half the backslashes. The combined version reaches 23
  on runs-as-written without either rule, and fixes real-adopt-clamp in 3 of 3.
- **criteria-not-methods dropped.** It gets builder-criteria to 27 of 27, but its target methods-private does not
  move (11), and one-check-per-line, runs-as-written, catches-traps and avoids-must-not all get worse.
- **traps-named not run.** It was the conditional fifth candidate. The sets that were run, about 2.86M fresh stage tokens plus about 4.75M in judge sessions, left too little of the 9M step-back budget for another 27-run set and its judging. Its target, catches-traps on planted-missing-line, stays a next target (below).
- **combined (words-test + proof-at-head) kept** as the new `workflows/quick-fix/brief.md`. Against the baseline it is
  better on words-only (10 to 20), runs-as-written (19 to 23) and avoids-must-not (18 to 24). catches-traps is level
  at 20: it gains the after-merge case and loses one run each on missing-line, prescribed-fix and jsonl-lint.
  builder-criteria is worse (18 to 12), the trade accepted above.

## The blind reads disagree

Two blind reads by a fresh `claude -p` session in an empty folder, with no tools and no settings, prefer the baseline.
The seed 1 read is 7 to 0 with 2 even, and the seed 2 read is 5 to 1 with 3 even
(`bench/brief/reports/blind-combined/`, `blind-combined-seed2/`, each with its key). The reasons they give are the
ones this rubric scores as faults. They prefer checks that are "more mechanical", that require exit 0 or one exact
output string where the line names neither, and, on planted-after-merge, a verifier that fetches the live page and
FAILs until merge. The reader is not told that a stricter check fails a good build and costs a rebuild, or that a PR
whose after-merge line FAILs at its head can never pass. Those are the 4 Nov stage critique's findings, and they are
why words-only and the after-merge case exist.

Decided: keep the combined version on the scores, and record that the outcome's "a blind A/B read agrees" is not met.
The blind read stays a check on taste, not a gate. The disagreement is real information, though: a reader without the
harness's rules prefers strictness. The next refinement should either give the blind reader the stage's
constraints (its Rules section), or test whether the scored criteria predict real-run outcomes, which is the
prompt-refinement decision's own stop rule. One remark from both reads is worth its own variant: the baseline more
often gives the verifier a script that fails on its own, where the combined version leaves more checks to reading.

Next targets for the brief: builder-criteria and methods-private, the two new criteria no variant improved without
losses, and catches-traps on planted-missing-line (1 of 3 and 0 of 3).
