```json
{
  "id": "wf-intake",
  "title": "Shape and challenge an issue before quick-fix briefs it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A request (the person's words or a GitHub issue, with its url) starts a new intake workflow whose two model stages turn it into a frozen issue before any build: shape writes the problem, reason, outcome, expect lines each with a proof kind, non-goals and assumptions; an independent challenge stage, given the request and the issue but not the shaper's reasoning, tries to describe a build that meets every line and is still wrong and fails each line that lets one through, is ambiguous, or can only be checked after merge; shape revises at most twice, then a card takes the person's words or the stand-in's default; the frozen issue starts a quick-fix child item. Both stages have benches, and their prompts were chosen on them.",
  "why": "The expect lines decide what every later stage builds and checks, and today they are written by hand outside the harness, with no stage, record or review (five whys root cause A, plan/decisions/2026-11-05-prompt-refinement.md). Thinking here costs minutes of reading; a wrong line costs a build, a verify and a replan. The plan's own items already carry proof kinds, non-goals and an independent read (L-expect-checkable-before-accept, L-issues-state-problems, L-plans-need-independent-read); a quick-fix issue carries none of it. The design choices (a separate intake workflow that starts quick-fix as a child, so quick-fix and every done item's tests stay as they are; the challenge covering the expect lines so the chart may decide on it; goal questions taken with a recorded default rather than a card that would idle on the person) are in plan/decisions/2026-11-05-wf-intake-ready.md.",
  "serves": [
    "L-expect-checkable-before-accept",
    "L-issues-state-problems",
    "L-plans-need-independent-read",
    "L-stage-needs-bench",
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "stage-bench",
    "stage-prompt-files"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-05-wf-intake-ready.md",
      "what": "The workflow, schemas, proof kinds, where the frozen issue is recorded, the card, the bench cases and why the ripple into quick-fix is pass-through only"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "checkStages(): the coverage rule (a stage given lines that the chart decides on must cover them) that shapes the challenge output and keeps the chart from deciding on shape's output"
    },
    {
      "ref": "packages/engine/src/effects/item.js",
      "what": "A workflow named as an actor starts a child item with the invoke input; its final output comes back as the done event"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "The child: its item input (issue with url and expect) and #issue schema, which allows extra fields"
    },
    {
      "ref": "scripts/bench/",
      "what": "run.mjs, score.mjs, compare.mjs and lib.mjs: generic over stages except the brief-specific mechanical criteria, judge presentation, blind packet and the quick-fix default"
    },
    {
      "ref": "bench/brief/",
      "what": "The case, rubric and judge-check formats; the planted seed repos can be reused"
    },
    {
      "ref": "docs/prompts.md",
      "what": "The refinement procedure both stages follow"
    },
    {
      "ref": "/mnt/project-files/research/gan-and-harness-design/05-distilled.md",
      "what": "Findings 2 and 3: freeze criteria before build; an independent reader commits its expectation before reading claims"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/intake.json",
      "what": "States shaping, challenging, stuck (the card), fixing (the quick-fix child), done and dropped; stages shape and challenge; item input { request: { url, text } }"
    },
    {
      "ref": "workflows/intake/shape.md, workflows/intake/challenge.md",
      "what": "The two stage files"
    },
    {
      "ref": "scripts/bench/",
      "what": "Per-stage scoring (mechanical criteria, how the judge sees an output, the blind packet) and the workflow named by the rubric, so shape and challenge bench like brief, with tests"
    },
    {
      "ref": "bench/shape/, bench/challenge/",
      "what": "rubric.json (approved by the stand-in, recorded), cases/, judge-check/, runs/ (baseline and the variants tried) and reports/"
    },
    {
      "ref": "docs/prompts.md",
      "what": "The intake stages in the source table and the bench commands; how a stage of another workflow is benched"
    },
    {
      "ref": "docs/layout.md",
      "what": "workflows/intake.json and its stage folder, and that an item now starts from a request through intake"
    }
  ],
  "expect": [
    {
      "id": "chart",
      "check": "workflows/intake.json loads through the engine's own load check, and driven with stub agents: shape then a PASS challenge starts one quick-fix child whose item input issue is shape's issue with url set to the request's url; a FAIL challenge reruns shape with that challenge as its input, at most twice, and a third FAIL puts a card up; the card's revise answer (with words) reruns shape with the answer, build-as-is starts the child, drop ends the item dropped; shape's blocked answer reaches the card; the child's end ends intake done with the child's output",
      "how": "The verifier's own test, driving the real host with stub agents",
      "proof": "verifier"
    },
    {
      "id": "independent",
      "check": "The challenge run's prompt holds the request and the issue and none of shape's other output; a challenge result whose lines skip, add, reorder or contradict the issue's expect lines, or whose PASS disagrees with a FAIL line, is refused at accept",
      "how": "The verifier renders the challenge prompt and calls accept with bad results",
      "proof": "verifier"
    },
    {
      "id": "frozen",
      "check": "The frozen issue is recorded: the PASS challenge run's input issue, byte for byte, is the quick-fix child's start input issue in its journal, and that child's brief run receives it with every new field (title, problem, reason, outcome, proofs, non_goals, assumptions) passed through",
      "how": "The verifier's own test on the journal its driven item writes",
      "proof": "verifier"
    },
    {
      "id": "benches",
      "check": "bench/shape and bench/challenge each have a rubric approved by the stand-in and recorded in plan/decisions/, at least 6 cases with planted traps among half-met lines, fixes stated as requirements, missing regressions and after-merge lines (challenge also has at least 2 clean issues that should PASS), a judge check of at least 6 hand-graded outputs with at least 3 planted bad that score.mjs --judge-check passes, and a committed baseline of at least 3 runs per case whose report score.mjs recomputes from the run folders with --no-judge",
      "how": "The verifier reruns score.mjs --judge-check and --no-judge, and reads the cases' repos for each trap",
      "proof": "verifier"
    },
    {
      "id": "chosen",
      "check": "For each stage at least one variant aimed at a criterion its first draft failed was run on the same cases, compared with compare.mjs, and given a blind read by a fresh session; the stage file on the branch is the version the compare report and the PR say was kept, and the brief bench still scores and compares as before",
      "how": "The verifier reads the reports and blind reads, diffs the kept version against the stage file, and reruns the brief bench's --no-judge scoring",
      "proof": "verifier"
    },
    {
      "id": "real",
      "check": "A real model run of shape and then of challenge on its output, through scripts/bench/run.mjs on a case the verifier writes itself (a request on a seed repo with one trap the verifier plants), writes run folders that scripts/inspector/build.mjs shows, and the challenge FAILs the trapped line or shape's issue already closes the trap",
      "how": "The verifier writes the case, runs both stages with a real model and builds the Inspector page",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "intake workflow: a request shaped and challenged into a frozen issue, which starts a quick-fix child",
      "challenge stage: an independent stage that tries to break an issue before it is built"
    ],
    "budget": 2
  },
  "non_goals": [
    "No change to quick-fix's stage files or prompts: the new issue fields pass through; refine-brief-stage decides how the brief uses them",
    "No card for every goal question: shape takes a stated default and records it under assumptions; the card is reached only when the challenge still fails after two revisions or shape is blocked (plan/decisions/2026-11-05-wf-intake-ready.md)",
    "No GitHub issue is created or edited: the request's url is where it came from, and the frozen issue lives in the journal",
    "No change to the engine's coverage rule or accept()",
    "No second workflow, and no change to research or feature"
  ],
  "records": [
    "shape's and challenge's run folders (brief.md, stage.json, result.json) in the intake item's journal, each revision its own run",
    "the frozen issue as the quick-fix child's start input in its journal",
    "bench/shape and bench/challenge run folders, reports, judge checks and blind reads"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 4000000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

It adds the front of the factory: an intake workflow that turns a request into a frozen issue and only then starts
quick-fix, so the hard thinking is done and attacked while it costs minutes of reading, not a build. The layout,
schemas and card are decided in `plan/decisions/2026-11-05-wf-intake-ready.md`. Quick-fix itself is not changed:
its issue schema already takes extra fields, so the new ones reach brief, build and verify as they are, and
refine-brief-stage decides how the brief uses them.

Both stages are written in stage files and measured on the stage bench by the `docs/prompts.md` procedure, with the
building thread as the person's stand-in approving each rubric. The bench is generalised only as far as a second
workflow's stages need: which workflow a stage belongs to, its mechanical criteria, and how a judge and a blind
reader see its output.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under `verify/wf-intake/`
without reading the builder's. For chart, load `workflows/intake.json` with the engine and drive items through the
real host (`restore`, `offer`) with stub agents you write, through every route the line names, reading the journal
and the child item. For independent, render the challenge prompt for a made-up issue and request, and call
`accept()` with results that skip, add, reorder or contradict lines. For frozen, compare the PASS challenge run's
input with the child's start row and the child's brief run input. For benches and chosen, run
`node scripts/bench/score.mjs --stage <stage> --judge-check` and `--runs <baseline> --no-judge --report <tmp>` for
shape, challenge and brief, compare with the committed reports, read each case's seed repo for its trap, and read the
compare reports and blind reads. For real, write your own case (a request on a small seed repo with a trap you plant),
run shape and then challenge on shape's issue with a real model through `scripts/bench/run.mjs`, and build the
Inspector from the run folders. Read the ci check at the head sha. Commit `verify/wf-intake/verdict.json` with a
verdict per Expect id.
