```json
{
  "id": "obs-live-capture",
  "title": "Record every tool call, agent, wake, token, brief and result as it happens",
  "stage": "s1-observability",
  "kind": "build",
  "status": "ready",
  "outcome": "While a session runs, the journal gains a row for each tool call, subagent start and finish, wake, hook run and turn usage, attributed to session and agent, and each subagent brief and result is stored as a blob linked by hash.",
  "why": "v1 recovered its history by salvaging session logs afterwards: slow, partial and racing an unknown retention window. A mod sees every call live, with the agent id, so recording at the source is cheaper and complete.",
  "serves": [
    "L-attribute-tokens-to-item",
    "L-bind-by-guess",
    "L-briefs-durable",
    "L-hook-time-budget",
    "L-record-live-not-salvage",
    "L-subagents-distinguishable-by-hooks",
    "L-usage-windows"
  ],
  "depends_on": [
    "env-bootstrap"
  ],
  "inputs": [
    {
      "ref": "packages/journal",
      "what": "append() and the kinds vocabulary"
    },
    {
      "ref": "plan/research/platform-baseline.md",
      "what": "Which mod events exist on this Claude Code version, or the hooks fallback"
    }
  ],
  "outputs": [
    {
      "ref": "plugins/harness/hooks/capture (mod module, with a hooks fallback)",
      "what": "tool.call {tool, inputHash, inputBytes, ms, ok}, agent.spawn {agentId, type, model, briefHash}, agent.finish {agentId, ms, tokens}, wake {reason, source}, hook.run {name, ms, timedOut}, turn.usage {tokens, cost, fiveHour, sevenDay}"
    },
    {
      "ref": "<journal root>/blobs/<sha256>",
      "what": "Brief and result texts, stored once by content hash (merged from obs-briefs-and-results)"
    }
  ],
  "expect": [
    {
      "id": "complete",
      "check": "For a recorded fixture session (its transcript and expected rows checked in), capture produces a row for every tool call, and none extra",
      "how": "Test replays the fixture transcript through the capture handlers"
    },
    {
      "id": "attributed",
      "check": "Subagent calls carry the subagent's agentId; the parent's carry none",
      "how": "Same fixture, which includes one subagent"
    },
    {
      "id": "no-content",
      "check": "Rows hold hashes and sizes of tool inputs, never the raw input or any secret",
      "how": "Test with a secret-looking input; grep the output"
    },
    {
      "id": "blobs",
      "check": "The fixture's subagent brief and final answer exist as blobs whose hashes match the rows, stored once",
      "how": "Test recomputes sha256"
    },
    {
      "id": "cheap",
      "check": "Capture's own time per call is measured and reported",
      "how": "hook.run rows in the fixture run"
    }
  ],
  "cases": [],
  "concepts": {
    "adds": [
      "capture",
      "blob"
    ],
    "budget": 2
  },
  "non_goals": [
    "No item or step tags yet (engine rows add them in stage 3)",
    "No page"
  ],
  "records": [
    "agent.finish",
    "agent.spawn",
    "brief.stored",
    "hook.run",
    "result.stored",
    "tool.call",
    "turn.usage",
    "wake"
  ],
  "person_prereqs": [
    "None beyond person-setup-sitting"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 2500000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": [
    "Mods are early access; if the API shifts, the hooks fallback must cover the same rows"
  ],
  "after_landing": [
    "Compare one real session in the v2 project with its own event log (the stage gate)"
  ]
}
```
## Verifier brief

Record your own short headless session (two tool calls, one subagent with one call), turn its transcript into a
fixture, and run capture over it. Every call must appear once, with the right agent, and the brief and answer must be
stored as blobs. Grep the output for the test secret. Verdict per Expect id.
