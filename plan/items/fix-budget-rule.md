```json
{
  "id": "fix-budget-rule",
  "title": "Decide when repeated fixes to one module start a redesign item",
  "stage": "s5-parity",
  "kind": "decision",
  "status": "draft",
  "outcome": "plan/README.md says a fix item names the module it changes, and a third fix item to the same module within 14 days makes the next item there a design item that names the recurring concept and designs it twice.",
  "why": "Step back counts rounds within one item, but nothing counts fixes across items; 76 of 148 main commits since 11-04 are fixes (APOSD strategic programming; research plan/research/design-books-cleanup.md, finding 8).",
  "serves": [
    "L-count-concepts",
    "L-replan-after-second-fail"
  ],
  "depends_on": []
}
```

Draft from `plan/research/design-books-cleanup.md`, finding 8: the smell, the evidence with file and line, and the change are there. Not ready: inputs, outputs, expect, concepts and the verifier brief are still to write.
