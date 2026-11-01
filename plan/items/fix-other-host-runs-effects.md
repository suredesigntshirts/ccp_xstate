```json
{
  "id": "fix-other-host-runs-effects",
  "title": "Keep a host that doesn't own an item from running its effects",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A host restored by a session that doesn't own the item turns its events away and runs none of its open effects, so a card, post, spawn or merge the owner has open happens once even when another session's host wakes before the owner's.",
  "why": "parity-cases found offer() runs the item's open effects before it reads any input, whoever owns the item: another session's host posts the owner's pending card and writes the effect rows into the owner's file, and two hosts restored together post it twice (plan/decisions/2026-11-01-parity-cases-gaps.md).",
  "serves": [
    "L-effects-acked-once"
  ],
  "depends_on": [
    "parity-cases"
  ],
  "cases": [
    "C-two-hosts-one-item"
  ]
}
```
