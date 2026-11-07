```json
{
  "id": "run-names-one-module",
  "title": "Keep run naming and the result hash in one module every process loads",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Run id parsing, run and item paths, and the canonical result hash live in one dependency-free engine module; actors.js, effects/relay.js, plugins/harness/scripts/return-tool.mjs and scripts/inspector/export.mjs import it and keep no copy.",
  "why": "The run folder naming and the result hash are protocols two processes must agree on, copied in four places (Pragmatic DRY: knowledge, not text; research plan/research/design-books-cleanup.md, finding 3).",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": []
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 3: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
