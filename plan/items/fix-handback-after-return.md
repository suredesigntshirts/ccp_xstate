```json
{
  "id": "fix-handback-after-return",
  "title": "Stop refusing an agent's handback after its return was accepted",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "An agent whose return the harness accepted can hand back without a no-return refusal, and the journal keeps no refusal row for it; an agent that hands back without a return is still sent back once.",
  "why": "In fix-blocked-retry's real run (tournaments/2026-11-04-stage-contract/trials/blocked-retry/report.md), three of four agents had their SubagentHandback refused no-return after their return had been accepted. Each left a false refusal row, which the Inspector and the refusal views count as a refusal.",
  "serves": [
    "L-checks-against-world"
  ],
  "depends_on": [
    "fix-blocked-retry"
  ]
}
```

## What this is

Draft. A replan to ready finds why handedBack() or the SubagentHandback hook misses the accepted result (the result
file written by the PreToolUse return hook against the handback's own check), and fixes the check, not the rows.
