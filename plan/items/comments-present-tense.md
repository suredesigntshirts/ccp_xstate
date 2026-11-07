```json
{
  "id": "comments-present-tense",
  "title": "Make harness comments state what holds now, not which item added it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Source comments under packages/engine/src, plugins/harness/scripts and scripts/inspector state present-tense invariants with no plan-item, lane or tournament-round references; packages/engine/README.md describes the engine's entry points and guarantees instead of the fixes that shaped them; docs/layout.md states the comment rule.",
  "why": "About 50 history references in source comments make the code read as an archive, and every session that opens these files pays for it. The why already travels with the plan item and the commit (APOSD 12-13; research plan/research/design-books-cleanup.md, finding 2).",
  "serves": [
    "L-theory-written",
    "L-count-concepts"
  ],
  "depends_on": []
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 2: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
