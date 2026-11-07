```json
{
  "id": "inspector-reads-records",
  "title": "Have the Workflow Inspector read the engine's records instead of reconstructing them",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "scripts/inspector/export.mjs takes transition explanations from an engine export built on chart() and failing(), and prompt provenance and model-ness from stage.json and run.json; the string-literal scanning, the graph re-derivation and the brief.md inference are deleted.",
  "why": "The inspector, the person's main view of each stage, re-derives in 1,282 lines decisions the engine already records, so an engine change silently breaks it (APOSD information leakage; research plan/research/design-books-cleanup.md, finding 6).",
  "serves": [
    "L-facts-from-source",
    "L-pages-current-on-demand"
  ],
  "depends_on": [
    "retire-pinned-legacy",
    "harness-glossary"
  ]
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 6: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
