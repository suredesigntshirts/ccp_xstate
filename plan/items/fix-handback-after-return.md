```json
{
  "id": "fix-handback-after-return",
  "title": "Stop refusing an agent's handback after its return was accepted",
  "stage": "s5-parity",
  "kind": "build",
  "status": "dropped",
  "outcome": "An agent whose return the harness accepted can hand back without a no-return refusal, and the journal keeps no refusal row for it; an agent that hands back without a return is still sent back once.",
  "why": "Dropped 2026-11-05: the premise was a misreading (plan/decisions/2026-11-05-handback-after-return.md). In fix-blocked-retry's real run (tournaments/2026-11-04-stage-contract/trials/blocked-retry/report.md), three of four agents had their SubagentHandback refused no-return after their return had been accepted. Each left a false refusal row, which the Inspector and the refusal views count as a refusal.",
  "serves": [
    "L-checks-against-world"
  ],
  "depends_on": [
    "fix-blocked-retry"
  ]
}
```

## What this is

Dropped. The draft read the run's three `no-return` rows as handbacks refused after an accepted return. The run's own
capture says otherwise: each refused handback came before the agent loaded the return tool and returned, and the
agent's second handback, after the accepted return, went through. The send-back did what engine-actor-returns built it
to do, and the rows are true. The reading and what was kept are in plan/decisions/2026-11-05-handback-after-return.md.
