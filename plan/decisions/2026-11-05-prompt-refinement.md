# How stage prompts get refined (2026-11-05)

Asked by the person on 5 Nov: how can they audit and change each stage's prompt, how much thought went into the
prompts, and can Claude help refine each stage, starting with how an issue is made and how it becomes a work packet,
before any second workflow. The person said Claude leads architecture, so these are Claude's two-way-door decisions,
made from first principles. The full account and five whys are in the project doc "Stage prompts: how they were
made, and how we refine them" (https://claude.ai/artifact/TUhTuZP7dC2CAsxWyA2Aag).

## Findings that drive the decisions

- The harness records every prompt exactly (`runs/<n>.<actor>/brief.md`, `context.md`, `stage.json`) and the
  Inspector traces each line to its source. Reading is solved.
- Changing a prompt is blind. A stage cannot be run alone, nothing scores its output, and editing
  `workflows/quick-fix.json` turns `verify/trial-fail-path`'s replay test red, because it checks the trial journals
  against the current file's hash.
- The stage rules date from the 4 Nov stage-contract tournament. Since then they have changed twice, both times to fit
  a host check. Until then the brief stage's prompt was one generic line.
- The issue's `expect` lines are the root of every later stage, and they are written by hand outside the harness.
  No stage shapes them, checks them or records how they were made.

Five whys root causes: (A) the spec step is outside the factory; (B) stages have no bench. Ledger row
`L-stage-needs-bench`.

## Decisions

1. **Refinement is a dev-time tool in this repo, outside the running workflow.** A workflow that tunes its own
   prompts while running grades its own work, and the workflow pin (`fix-workflow-pinned`) exists to stop a builder
   from changing its own workflow. Refining a prompt is design work, and its output is a reviewed PR to
   `workflows/*.json` through the usual gates.
2. **The bench renders prompts with the engine's own `render()`.** There is no second copy of any prompt to drift.
   Bench runs write the same run folders as real runs, so the Inspector shows them.
3. **The person judges outcomes, not wording.** In the refinement loop (`docs/prompts.md`, built by stage-bench) the
   person, or a stand-in, approves each stage's rubric: what a good output must do. Claude writes the prompt, gathers
   and plants cases, measures the prompt, and gets a blind A/B read from a fresh session. That read guards against a
   model favouring its own text (research 05-distilled, finding 3).
4. **Bench first, then intake, then the brief.** Building intake without a bench would add one more untested first
   draft. So `stage-bench` (ready) comes first, with the existing brief stage as its first bench and a baseline. Then
   `wf-intake` (draft) adds an intake stage and an independent challenge stage before briefing. Then
   `refine-brief-stage` (draft) applies the research's adopt list to the work packet, keeping each change only where
   the bench shows it helps. Build and verify are refined after that. Verify's bench is the calibration set from
   research finding 5.
5. **No second workflow before the front of quick-fix is refined.** `second-workflow` now also depends on `wf-intake`
   and `refine-brief-stage`.
6. **Old journals replay on the workflow blob they pinned, not on the current file.** This is part of stage-bench,
   because every prompt change would otherwise break a done item's replay test.

## What would change these

- If a bench score fails to predict real-run outcomes (a prompt that scores better does worse in real items), the
  bench's cases or judge are wrong. Fix those before trusting any further bench-driven change.
- If running a stage alone cannot keep this host's ambient instructions out, bench runs record that. Scores are then
  compared only between runs under the same conditions.
