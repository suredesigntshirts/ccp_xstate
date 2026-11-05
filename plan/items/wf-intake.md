```json
{
  "id": "wf-intake",
  "title": "Shape and challenge an issue before quick-fix briefs it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Quick-fix starts from a request (the person's words or a GitHub issue) and two model stages turn it into a frozen issue before briefing: intake writes the problem, why, outcome, expect lines with proof kinds, non-goals and assumptions; an independent challenge stage tries to describe a build that meets every line and is still wrong, and flags lines that are ambiguous or not checkable before merge; intake revises at most twice; questions that change the goal reach a card with a stand-in default. Both stages have benches, and their prompts were chosen on them.",
  "why": "The expect lines decide what every later stage builds and checks, and today they are written by hand outside the harness, with no stage, record or review (five whys root cause A, plan/decisions/2026-11-05-prompt-refinement.md). Thinking here costs minutes of reading; a wrong line costs a build, a verify and a replan. The plan's own items already carry proof kinds, non-goals and an independent read (L-expect-checkable-before-accept, L-issues-state-problems, L-plans-need-independent-read); a quick-fix issue carries none of it.",
  "serves": [
    "L-expect-checkable-before-accept",
    "L-issues-state-problems",
    "L-plans-need-independent-read",
    "L-stage-needs-bench",
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "stage-bench"
  ]
}
```

## What this is

Draft. A replan to ready decides the stages' schemas, where the frozen issue is recorded, whether the challenge
stage may read the repo, the ask card's shape, and the bench cases: raw requests with known traps (half-met lines,
fixes stated as requirements, missing regressions, lines only checkable after merge). The rubric is approved through
the `docs/prompts.md` procedure. The issue schema change ripples into brief, build and verify inputs. That ripple is
part of this item, kept to passing the new fields through.
