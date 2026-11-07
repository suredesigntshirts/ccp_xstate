```json
{
  "id": "retire-pinned-legacy",
  "title": "Retire compatibility for items pinned to older workflow formats",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "After a recorded cutoff (every engine item in the project journal finished or dropped), the engine refuses an item pinned to a pre-stage-file or pre-timer format with a message to finish it on its own release, and the compatibility branches in index.js, prompts.js, stages.js and the inspector are gone.",
  "why": "Each keep-old-behaviour branch is small and together they are much of the reading cost; nothing is live (research plan/research/design-books-cleanup.md, finding 7).",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": []
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 7: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
