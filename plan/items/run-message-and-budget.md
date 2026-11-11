```json
{
  "id": "run-message-and-budget",
  "title": "Design the run's one state message and one budget twice",
  "stage": "s5-parity",
  "kind": "build",
  "status": "parked",
  "module": "packages/engine/src/run/store.js",
  "outcome": "The run store answers every hook's question about a run with one message built from its state and its spent budget, and the attempt budget is one number a run may spend on refusals, send-backs and stall blocks together; two designs for each were written and compared on the stage bench before one was built, and the losing design is recorded in the decision.",
  "why": "Parked 2026-11-11: no run has shown the caps or the hook answers conflicting, so designing both twice buys elegance, not a fix; it comes back when a real run does (plan/decisions/2026-11-11-triage.md). run-lifecycle-store deferred both on 2026-11-07 with the conservative reading, and no design was tried twice (design it twice; research plan/research/verification-swing.md, item 6).",
  "serves": [
    "L-count-concepts",
    "L-stage-needs-bench"
  ],
  "depends_on": [
    "verify-regression-set"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 6. It names `packages/engine/src/run/store.js` as its module,
so it is a design item for the fix budget. Waits for `verify-regression-set`: today `run-lifecycle-store`'s done
suite asserts the three caps and the hook answers byte for byte. The replan that readies it writes the two designs
and the bench comparison into `plan/decisions/`.
