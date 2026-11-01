```json
{
  "id": "fix-waiting-wake",
  "title": "Schedule a wake for an item waiting on the person",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "An item waiting on a person's card has a timer set, so a wake is scheduled for it, while other items advance on their own.",
  "why": "parity-cases found quick-fix's awaitingMerge and replanning set no timer, so nothing wakes an item that waits on a card; other items do advance, being separate files (plan/decisions/2026-11-01-parity-cases-gaps.md).",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "parity-cases"
  ],
  "cases": [
    "C-waiting-does-not-stall"
  ]
}
```
