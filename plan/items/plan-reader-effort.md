```json
{
  "id": "plan-reader-effort",
  "title": "Measure what a change costs its reader",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "For any merged PR, one command reports the files it touched, the exports it added or removed, the lines a reader must open to follow the change (the changed hunks plus the definitions they call), and the verifier lines and evidence lines it added, split code, tests, evidence and docs; the done replan of an item records the report beside its fix budget fields.",
  "why": "The 8 Nov review counted by hand what the plan should count, and the cleanups passed every gate while growing (complexity is what the reader experiences; research plan/research/verification-swing.md, item 7).",
  "serves": [
    "L-count-concepts",
    "L-harness-overhead"
  ],
  "depends_on": [
    "verification-contract"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 7. A script under `scripts/` or a derived view in
`packages/journal/src/derive/`, whichever the readying replan picks; it reads git, not the journal, for the file
numbers. The categoriser from the review (code, unit tests, verifier tests, evidence, docs) is the starting split.
