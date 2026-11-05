```json
{
  "id": "refine-brief-stage",
  "title": "Refine the brief stage's work packet on its bench",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The brief stage's rules are rewritten from the research adopt list and the bench, with one criterion per expect line and its proof kind, the builder given criteria and steps, the verifier's methods kept to the verifier, traps found in the repo named, and every check command dry-run before the brief is fixed; each change is kept only where bench/brief scores improve without a regression, and a blind A/B read by a fresh session agrees.",
  "why": "The brief is the work packet every later stage runs on, and its rules are a first draft from the 4 Nov tournament that has never been changed for quality (L-stage-needs-bench). The research adopt list (05-distilled findings 2 to 4 and 6) says what should change, but only the bench can say whether each change helps (plan/decisions/2026-11-05-prompt-refinement.md).",
  "serves": [
    "L-stage-needs-bench",
    "L-verifier-independent",
    "L-no-checks-the-builder-writes"
  ],
  "depends_on": [
    "stage-bench",
    "wf-intake"
  ]
}
```

## What this is

Draft. It comes after wf-intake because intake changes the brief's input (proof kinds, non-goals, assumptions). A
replan to ready fixes the candidate changes, each tied to a rubric criterion the baseline shows failing. Build and
verify get their own refinement items after this one. Verify's bench is the calibration set from research finding 5.
