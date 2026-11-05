```json
{
  "id": "fix-agent-finish-ms",
  "title": "Make agent.finish ms the agent's real run time",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A capture journal's agent.finish ms is the time from the agent's first prompt to its last message, within a second of the parent's Agent tool.call ms, for every named and built-in agent.",
  "why": "In probe-plugin-agents-thread the verifier's agent ran about 5 s but its agent.finish row says ms 508057022 (about 5.9 days); the builder's row was a sane 8200. capture-rows.mjs finish() takes max minus min over every timestamp in the subagent transcript, so one entry with an old timestamp (likely an injected attachment row) skews it. Time per item is one of v1's parity numbers, so the measure has to be right.",
  "serves": [],
  "depends_on": [
    "probe-plugin-agents-thread"
  ],
  "inputs": [
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs",
      "what": "finish(): how ms is computed"
    },
    {
      "ref": "verify/probe-plugin-agents-thread/evidence/",
      "what": "The verifier's subagent transcript and journal rows with the bad ms"
    }
  ]
}
```

## What this is

A draft from the probe-plugin-agents-thread verdict (side finding). Find which transcript entry carries the old
timestamp, then compute ms over user and assistant rows only, or from the Agent tool.call, and test it on that transcript.
