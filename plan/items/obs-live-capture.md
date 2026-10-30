```json
{
  "id": "obs-live-capture",
  "title": "Record every tool call, agent, wake and token as it happens",
  "stage": "s1-observability",
  "kind": "build",
  "status": "ready",
  "outcome": "While a session runs, the journal gains a row for each tool call, subagent start and finish, wake, hook run and turn's usage, each attributed to session and agent.",
  "why": "v1 recovered its history by salvaging session logs afterwards: slow, partial and racing an unknown retention window. A mod sees every call live, with the agent id, so recording at the source is cheaper and complete.",
  "serves": ["L-record-live-not-salvage", "L-attribute-tokens-to-item", "L-subagents-distinguishable-by-hooks", "L-bind-by-guess", "L-hook-time-budget", "L-usage-windows"],
  "depends_on": ["session-fingerprint-selfcheck"],
  "inputs": [
    { "ref": "packages/journal", "what": "append() and the kinds vocabulary" },
    { "ref": "plan/research/platform-baseline.md", "what": "Which mod events exist on this Claude Code version, or the hooks fallback" }
  ],
  "outputs": [
    { "ref": "plugins/harness/hooks/capture (mod module, with a hooks fallback)", "what": "tool.call {tool, inputHash, inputBytes, ms, ok}, agent.spawn {agentId, type, model, briefHash}, agent.finish {agentId, ms, tokens}, wake {reason, source}, hook.run {name, ms, timedOut}, turn.usage {tokens, cost, fiveHour, sevenDay}" }
  ],
  "expect": [
    { "id": "complete", "check": "For a test session, every tool call in its list_events log has a tool.call row", "how": "obs-journal-vs-world's compare script on that session reports 0 missing" },
    { "id": "attributed", "check": "Subagent calls carry the subagent's agentId; the parent's carry none", "how": "A test session that spawns one subagent; read its rows" },
    { "id": "no-content", "check": "Rows hold hashes and sizes of tool inputs, never the raw input or any secret", "how": "Test with a secret-looking input; grep the journal" },
    { "id": "cheap", "check": "Capture adds under 50 ms per tool call at the 95th percentile", "how": "hook.run rows for a test session" }
  ],
  "cases": [],
  "concepts": { "adds": ["capture"], "budget": 1 },
  "non_goals": ["No item or step tags yet (engine rows add them in stage 3)", "No page"],
  "records": ["tool.call", "agent.spawn", "agent.finish", "wake", "hook.run", "turn.usage"],
  "person_prereqs": ["If the probe showed a mod needs an allow rule to observe, place it and rebuild before this item's thread"],
  "step_back": { "max_rounds": 2, "max_tokens": 2500000 },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": ["Mods are early access; if the API shifts, the hooks fallback must cover the same rows"]
}
```

## Verifier brief

Run a short headless session with the plugin installed: two tool calls, one subagent with one tool call. Then compare
its rows with the session's own event log (list_events or the local transcript). Every call must appear once, with the
right agent. Grep the journal for the test secret. Verdict per Expect id.
