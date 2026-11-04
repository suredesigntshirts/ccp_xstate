```json
{
  "id": "fix-verify-issue-echo",
  "title": "Stop refusing a verdict that trims the issue it restates",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A verify result whose issue carries the input issue's url and expect exactly is accepted whether or not it repeats the title and body, or the output Schema itself requires every key the input issue has, so the Schema and the restated rule agree and a real verifier is not refused for following the Schema.",
  "why": "In the engine-stage-contract adopt trial (tournaments/2026-11-04-stage-contract/trials/adopt/report.md) the real verifier's first return was refused by rule restated: its issue held only url and expect, the two keys the verify Schema marks required, and dropped title and body, which the input had. The Output text says to copy the issue byte for byte, but the Schema reads as permission to send less. Trial 2 had already named this echo as the most fragile field (N5). Choosing between narrowing the comparison and widening the Schema is this item's first decision.",
  "serves": [
    "L-refusals-unmeasured",
    "L-agents-self-report"
  ],
  "depends_on": [
    "engine-stage-contract"
  ]
}
```
