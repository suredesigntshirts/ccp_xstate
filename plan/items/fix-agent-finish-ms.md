```json
{
  "id": "fix-agent-finish-ms",
  "title": "Make agent.finish ms the agent's real run time",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A capture journal's agent.finish ms is the time from the agent's brief to its last user or assistant message, so an entry stamped with a relayed message's old time no longer stretches it: for a foreground agent it is within a second of the parent's Agent tool.call ms, and for any agent within a second of its agent.finish row's at minus its agent.spawn row's at, for named and built-in agents alike.",
  "why": "In probe-plugin-agents-thread the verifier's agent ran about 5 s but its agent.finish row says ms 508057022 (about 5.9 days); four such rows exist across three sessions, and each one's earliest time is the written_at of a person's message the coordinator relayed into the thread (plan/decisions/2026-11-05-agent-finish-ms.md). capture-rows.mjs finish() takes max minus min over every timestamp in the subagent transcript, including attachment and other non-message rows. Time per item is one of v1's parity numbers, so the measure has to be right.",
  "serves": [
    "L-agent-time-from-messages"
  ],
  "depends_on": [
    "probe-plugin-agents-thread"
  ],
  "inputs": [
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs finish, spawn, read, lines",
      "what": "finish() reads the transcript's last READ_CAP bytes and sets ms = max - min over every row's timestamp; spawn() reads the first line from offset 0 for the brief"
    },
    {
      "ref": "verify/probe-plugin-agents-thread/evidence/",
      "what": "The verifier's subagent transcript (its 8 user and assistant rows) and the journal row with ms 508057022; today's finish() gives 4944 over that copy"
    },
    {
      "ref": "plan/decisions/2026-11-05-agent-finish-ms.md",
      "what": "The four bad rows, what their earliest time matches, and the decisions"
    }
  ],
  "outputs": [
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs finish",
      "what": "ms = last user or assistant row's timestamp minus the start (the first line's timestamp when it is a user row, read from offset 0; else the earliest user or assistant row read), counting only user and assistant rows at or after the start; null when there is no such row; every other agent.finish field unchanged"
    },
    {
      "ref": "plugins/harness/test/",
      "what": "The builder's tests: a transcript with an attachment row and a user row stamped days before the brief gives the run's real ms; a transcript longer than the read cap still starts at its brief; the probe-plugin-agents-thread evidence transcript gives its 4944"
    },
    {
      "ref": "docs/journal.md",
      "what": "agent.finish ms: from the brief to the last user or assistant message"
    }
  ],
  "expect": [
    {
      "id": "old-entry",
      "check": "Through the real capture hook script (plugins/harness/scripts/capture.mjs, or whichever script hooks.json runs for SubagentStop) with CCP_HARNESS_DIR at a harness folder, on a subagent transcript of real shape whose user and assistant rows span a few seconds plus an attachment row and a user row each stamped 2026-10-30T10:13:50.430Z: the agent.finish row's ms is the span from the brief to the last message, within 10 ms; on main the same input gives about 5.9 days",
      "how": "The verifier's own test, run at the head and at main",
      "proof": "verifier"
    },
    {
      "id": "long-transcript",
      "check": "For a transcript longer than READ_CAP whose brief is its first line, ms starts at the brief; a transcript whose first line is not a user row, an empty or unreadable transcript, and one with no user or assistant row give what the outputs line says (earliest message, null, null) without throwing",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "unchanged",
      "check": "Every other agent.finish field, the result.stored row and blob, refusal rows and every other hook's rows are main's for the same inputs; every engine, plugin and verify test that passes on main passes; no prompt or workflow file changes",
      "how": "node --test over packages/, plugins/ and verify/, and the diff against main",
      "proof": "verifier"
    },
    {
      "id": "real-agents",
      "check": "In a real Claude Code session with the PR's harness plugin loaded (headless claude -p --plugin-dir), one foreground named agent (ccp-harness:probe-reader), one foreground built-in agent and one background built-in agent each finish; each agent.finish ms is within 1000 of its agent.finish at minus agent.spawn at, and each foreground one's is within 1000 of the parent's Agent tool.call ms",
      "how": "The verifier's own run, with the rows read from the journal",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No rewrite of the four bad rows already in the journals; the journal is append-only and nothing reads agent.finish ms today",
    "No split of a resumed agent's runs: a SendMessage continuation still measures from its first brief (plan/decisions/2026-11-05-agent-finish-ms.md, decision 5)",
    "No use of the parent's Agent tool.call in finish(): SubagentStop has no tool result, and a background agent's call returns at once",
    "No prompt change, so no bench rerun and no workflow hash change"
  ],
  "records": [
    "agent.finish ms counts only the agent's own messages, from its brief"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "No bad transcript survives, so which entry type carried the old time is inferred; the guard drops any row before the brief whatever its type, which covers a relayed message landing in a user row too",
    "If Claude Code ever writes the brief row with a relayed time, the start would be wrong; the real-agents line checks against the spawn row and the Agent call"
  ]
}
```

## What this is

When a subagent finishes, the harness records how long it ran. A few rows say days for agents that ran seconds,
because the time was taken over every line of the agent's transcript, and some line carried the time a person's old
message was written. This item counts only the agent's own messages, from its brief to its last message.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read the decision
plan/decisions/2026-11-05-agent-finish-ms.md, and write your own tests under `verify/fix-agent-finish-ms/` without
reading the builder's. Build subagent transcripts of real shape (a real one has user, assistant and attachment rows;
look at one your own session writes under ~/.claude/projects/<project>/<session>/subagents/), add rows stamped
2026-10-30T10:13:50.430Z, and pipe SubagentStop hook inputs into the real capture hook script with CCP_HARNESS_DIR at
a harness folder (install.json + journal/; plugins/harness/test/capture.test.mjs shows how), then read the
agent.finish row. Run the same at main and show the ms differs. For long-transcript, write one over READ_CAP. For
unchanged, compare every hook's rows at the head and at main on the same inputs, run `npm test`, and read the diff.
For real-agents, run a headless `claude -p --plugin-dir plugins/harness` session that starts a foreground
ccp-harness:probe-reader agent, a foreground built-in agent and a background built-in agent, and read the
agent.spawn, agent.finish and Agent tool.call rows from the journal; a headless claude -p in a cloud container
inherits CLAUDE_CODE_REMOTE_SESSION_ID, so find its rows by its own session id or its sessionName. Break the fix
(take max minus min over every row again) and show a builder test going red. Read the ci check at the head sha. This
container signs commits: commit any evidence holding commit shas with `GIT_CONFIG_GLOBAL=/dev/null git -c
commit.gpgsign=false commit`. Commit `verify/fix-agent-finish-ms/verdict.json` with a verdict per Expect id.
