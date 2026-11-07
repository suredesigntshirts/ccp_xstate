```json
{
  "id": "harness-glossary",
  "title": "Give each harness concept one word per context",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "docs/language.md lists the plan, engine, platform and observation terms with the code that carries each; brief means only the brief stage and its output (the run prompt is prompt.md and prompt.stored); the capture hook writes its own row kinds instead of brief.stored and result.stored, under a journal version bump; CLAUDE.md tells builders to use the glossary's terms and add a line before introducing a new one.",
  "why": "brief, actor, stage, brief.stored and result.stored each carry two or three meanings, and the inspector already needs comments to translate between them (DDD ubiquitous language; research plan/research/design-books-cleanup.md, finding 1).",
  "serves": [
    "L-record-route-at-write",
    "L-version-event-schema",
    "L-pages-current-on-demand"
  ],
  "depends_on": []
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 1: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
