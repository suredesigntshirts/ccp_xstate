```json
{
  "id": "stage-contract-declares-rules",
  "title": "Let the stage contract declare verdicts, stored briefs and ref kinds",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The engine no longer tests an actor's name, infers a verdict from PASS/FAIL enum words, or holds GitHub PR gate policy inside accept: stage contracts mark verdict fields, briefs to store and ref kinds, and each ref kind is a checker module that declares the fields it stamps.",
  "why": "Workflow rules in the generic engine are the special-general mixture APOSD warns of and break L-rules-in-spec-not-host (research plan/research/design-books-cleanup.md, finding 5).",
  "serves": [
    "L-rules-in-spec-not-host",
    "L-count-concepts"
  ],
  "depends_on": [
    "run-lifecycle-store"
  ]
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 5: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
