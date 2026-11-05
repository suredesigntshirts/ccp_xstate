# Issue intake: workflow, schemas, card and benches (2026-11-05)

Claude's two-way-door decisions as architecture lead, made when `wf-intake` went ready. They follow
`plan/decisions/2026-11-05-prompt-refinement.md` (root cause A: the expect lines are written by hand outside the
factory, with no stage, record or review).

## A separate intake workflow that starts quick-fix as a child

Intake is its own workflow, `workflows/intake.json`, not two more states at the front of quick-fix. Its final step
invokes `quick-fix` with the frozen issue, which starts a child item (design A 4.2, `effects/item.js`), so one request
still ends in one merged PR.

- Quick-fix stays byte for byte as it is. 84 test files load it, most through done items' verifier tests that drive
  it from `briefing`; a new initial state would turn them red for no gain in what they prove.
- A frozen issue is then simply the child's start input: it is recorded in the child's journal and pinned by the
  child's workflow pin, and anything that starts quick-fix by hand (the feature workflow's slices, a test) still can.
- Quick-fix's `#issue` schema requires only `url` and `expect` and allows other fields, so the new fields reach brief,
  build and verify unchanged. How the brief uses them is refine-brief-stage's job, measured on the brief bench; this
  item changes no quick-fix prompt.

## The stages and their schemas

**shape** (inputs: task, request, challenge, answer). `request` is `{ url, text }`: the person's words or a GitHub
issue's body, and where it came from. `challenge` is the last challenge result (null on the first round) and
`answer` the card's answer (null unless the person or stand-in answered). Output `issue`:

- `title`; `problem` (what is wrong or missing, observed, with no fix); `reason` (why it matters; not `why`, which in
  quick-fix is the replan's five whys); `outcome` (what is true when done);
- `expect`: the acceptance lines, strings, as quick-fix takes them;
- `proofs`: one entry per expect line, in order, `{ line, proof, how }`, where proof is `run` (a command run at the PR
  head shows it), `ci` (a named CI check green at the head shows it) or `read` (only reading files at the head shows
  it). There is no after-merge kind: a line that can only be checked after merge is rewritten as something checkable
  at the head, or moved to the outcome or non-goals;
- `non_goals` and `assumptions`: lists of strings, may be empty.

Shape may answer `blocked` with a reason when the request is not one change to this repository. The url is not
shape's to write: the host sets `issue.url` from `request.url` on the way out.

**challenge** (inputs: task, request, issue). It sees the request and the issue, never shape's other output or
reasoning. It reads the repository, changes nothing, and returns `result` (PASS or FAIL), `lines` (one `{ line, result,
evidence }` per expect line, covering `issue.expect`) and `wrong_build` (the strongest build it found that meets every
line and is still wrong against the problem or outcome, or why it found none). A line FAILs when a wrong build meets
it, when two readers could check it differently, or when it can only be checked after merge. A wrong build that meets
every line means a line is missing; it FAILs the line nearest to what that build gets wrong and says which line is
missing.

The engine's coverage rule (`checkStages` in `stages.js`) decides two things here, and it is kept as it is:

- The chart decides on challenge's result, and challenge is given lines, so challenge must cover them: `lines`
  declares `covers: "issue.expect"`, and accept refuses lines that skip, add or reorder, and a PASS that disagrees
  with a FAIL line. This is why a missing line is pinned to its nearest line rather than reported apart.
- Shape is given lines on a revision (the challenge result), so the chart may not decide on shape's output. That is
  why goal questions are not a branch on shape's output (next section).

## Goal questions and the card

The draft said goal-changing questions reach a card with a stand-in default. Decided instead: shape takes a default
for every open question and records it under `assumptions`, and the challenge FAILs a line that rests on a default it
judges wrong. The card is reached in two cases only: the challenge still FAILs after two revisions, or shape is
blocked. Reasons:

- The person is away for hours and asked that threads never idle on them and that taps be kept for one-way doors
  into production (L-never-idle-on-person; the feedback of 4 Nov). A card per goal question is a tap per item.
- A branch on shape's output is refused by the coverage rule above, and loosening that rule to allow it would let a
  stage given lines steer the chart unchecked.
- The defaults are visible: they are in the frozen issue, which is in the child's journal and on the item page.

The card (`stuck`) asks "Intake could not freeze an issue for this request: the challenge still breaks it after two
revisions, or shape was blocked. Revise it with your answer, build the last version as it stands, or drop it?" with
choices `revise` (needs the answer's words, which go to shape as `answer`), `build as is` (only when an issue exists)
and `drop`. Like quick-fix's replanning card it sets the checkBack timer and waits; one revise answer buys one more
round.

## Revision cap

Two revisions, so three shapes and three challenges at most before the card, counted by host-set flags (`revised`,
`rerevised`) as quick-fix counts builds. Each round is its own run folder, so every version of the issue and every
challenge stays in the journal.

## Benches

Each stage gets `bench/<stage>/` like `bench/brief/`. The rubric names the workflow (`"workflow": "intake"`), and the
bench's brief-specific code (mechanical criteria, the judge's view of an output, the blind packet) moves to one
module per stage under `scripts/bench/stages/`, so brief scores and compares exactly as before.

- shape cases: raw requests on seed repos with traps: a request that half-states a rule the repo already breaks, a
  fix stated as a requirement, a bug report with no regression asked for, an after-merge ask (release or deploy), a
  vague ask, and one real request (the first real issue's lint request on the product test repo).
- challenge cases: shaped issues with their requests, planted with a half-met line, an ambiguous line, an after-merge
  line, a missing regression line, and at least two clean issues that must PASS, so a challenger that always FAILs
  scores badly. Challenge's verdict per line is scored mechanically against the case's planted lines.
- The rubrics are approved by the building thread as the person's stand-in, recorded here when the build fixes them.

## What would change these

- If the challenge FAILs clean issues on the bench more than once in three runs, it is too strict to gate on, and
  the cap goes to the card too often: then its PASS/FAIL becomes advice to shape and only a missing or after-merge
  line gates.
- If real items show the person wanting to answer goal questions before the build, the card moves earlier, with a
  coverage-safe way to decide on it (a host check of `assumptions`, not the model's word).

## After the build (5 Nov)

Decisions made while building, as the person's stand-in:

- **Rubrics approved.** `bench/shape/rubric.json` and `bench/challenge/rubric.json` are approved by the building
  thread as stand-in, recorded here. Challenge's verdicts are scored mechanically against each case's planted lines;
  everything else is judged.
- **Revision cap wiring.** A guard is checked against the context as its actions leave it (spec.js bindTransition),
  so the cap is three host flags shifted once per FAIL (`failed1..3`). The third FAIL sets `failed3`, and the card
  follows. The guard is `failed3` still null.
- **Cases corrected, not the challenger.** In the first challenge baseline, the challenger found real holes in two
  of the "clean" cases and in planted-ambiguous. Those cases were fixed and run again
  (`bench/challenge/reports/baseline.md`).
- **The judge sees file contents for claims about code.** For shape's `grounded` and challenge's evidence criteria,
  a file list made the judge fail true claims as unverified. Brief's judge is unchanged, so its kept verdicts stand.
- **Trades accepted.** The kept shape variant (observable lines) is better on states-problem and catches-traps.
  It loses one grounded run, on a seed-repo commit hash the judge cannot see. The kept challenge variant (good-faith
  wrong builds) is better on verdict-right, passes-sound, evidence-grounded and catches-traps, and holds every
  planted hole. It loses two avoids-must-not runs, each a sound line failed for a test its words do not ask for. Both
  trades are accepted here. The procedure allows a worse criterion only with a written acceptance. The blind reads
  lean to the variants only narrowly, case by case (X and Y are shuffled per case, so an overall "X" names no
  version): shape 3 cases to 3 with 1 even, challenge 3 to 2 with 2 even. They are no reason to keep a variant; the
  scores are. Next to target: challenge's over-strict lines (avoids-must-not), and fixed committer dates
  for seed repos so their hashes are stable.
