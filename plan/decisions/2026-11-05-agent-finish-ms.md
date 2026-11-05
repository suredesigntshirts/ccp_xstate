# agent.finish ms: the agent's own messages, from its brief (2026-11-05)

Item: fix-agent-finish-ms. Two-way doors, decided by the building thread as the person's stand-in, when the item
went ready.

## What the journals show

Over every session journal in the project's shared harness folder on 2026-11-05 13:25Z, four `agent.finish` rows
have an `ms` over a day, in three sessions, for agents that ran seconds or minutes:

| Session | Agent | ms | Row `at` minus ms |
|---|---|---|---|
| session_01KfkB5GUkYerz6U2CEzYneX (probe-plugin-agents-thread verifier) | adda18087b10e0b3a | 508057022 | 2026-10-30T10:13:50.579Z |
| session_01KfkB5FsNZ8wmHJgFAZBA | a5bf754bd2bf54ff1 | 495080978 | 2026-10-30T10:13:50.595Z |
| session_01KfkB5FsNZ8wmHJgFAZBA | a5bf754bd2bf54ff1 | 496912195 | 2026-10-30T10:13:50.606Z |
| session_01KfkB5JEZ4uMcFhW1293j | a0cef828098c9aa7b | (over a day) | 2026-10-31T02:40:36.216Z |

`at` minus ms is the earliest timestamp finish() saw, give or take the hook's own latency. Every one is the time a
person's message was written in the project, not a time anything ran: 2026-10-30T10:13:50.430149Z is the
`written_at` of the person's "User is not around" message, which the coordinator attaches to every thread it starts
(this thread's own transcript holds it in the first prompt's `hearthRelayRows`), and 2026-10-31T02:40Z is the person's
"continue past s3" message. So some entry in those subagent transcripts carried a relayed message's original time as
its `timestamp`, and `Math.max(...times) - Math.min(...times)` over every entry turned it into days.

The verifier's committed copy of its transcript (verify/probe-plugin-agents-thread/evidence/) holds only its 8 user and
assistant rows; replaying today's finish() over it gives ms 4944 against the Agent tool.call's 5030, with the same
tokens and result hash as the bad row. A transcript written now (this thread's own Explore agent, 2026-11-05 13:24Z)
holds 21 rows, 11 of them `attachment` rows (deferred tools, skill listing, prompt snapshots and the like), all
timestamped at the run. Which entry type carries the old time was not seen directly: no bad transcript survives.

## Decisions

1. **Only the agent's own messages count.** ms is the last `user` or `assistant` row's timestamp minus the start,
   and only `user` and `assistant` rows at or after the start count. `attachment`, `system`, `summary` and any other
   row type are ignored for time, wherever they sit; tokens, model and the answer are read as today.
2. **The start is the brief.** The start is the timestamp of the transcript's first line when it is a `user` row,
   read from offset 0 as spawn() reads the brief, because finish() reads the file's tail and a transcript over the
   read cap would lose it. If the first line can't be read or isn't a user row, the start is the earliest user or
   assistant row in what was read. Rows timestamped before the start are dropped, so a relayed message stamped days
   ago can't stretch a run even if it lands in a user row.
3. **No Agent tool.call in finish().** SubagentStop has no tool result, and a background agent's Agent call returns
   in milliseconds, so the parent's call can only check ms, not give it.
4. **Old rows stay.** The journal is append-only; the four bad rows are left. Nothing reads agent.finish ms today
   (derive/time.js reads tool.call and hook.run ms; the observe page and overhead.js read tokens), so no reader needs
   a guard.
5. **A resumed agent keeps today's span.** An agent continued by SendMessage writes to the same transcript, so its
   second SubagentStop measures from the first brief (session_01KfkB5F7WKxovGpwv21dn's a129d8ff0841bab02: 26734, then
   53605). Splitting runs is not this item; it is in non_goals.
