```json
{
  "id": "run-lifecycle-store",
  "title": "Model an agent run's lifecycle explicitly in one run store",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "One run store owns a run's folder and exposes its state (prepared, spawned, bound, returned, failed) and transitions; every actor hook asks it; the refusal, handback and stall caps are one attempt budget per run recorded in run.json; actors.js is split by knowledge (store, worktree, accept, supervise).",
  "why": "The run lifecycle exists only as which files exist, checked separately by eight hook functions with three caps, and five of the eight 11-05 fixes patched this module (DDD make implicit concepts explicit, APOSD define errors out of existence; research plan/research/design-books-cleanup.md, finding 4).",
  "serves": [
    "L-count-concepts",
    "L-replan-after-second-fail"
  ],
  "depends_on": [
    "run-names-one-module"
  ]
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 4: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
