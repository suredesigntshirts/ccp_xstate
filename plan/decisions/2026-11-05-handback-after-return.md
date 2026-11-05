# The handback refusals were true, and a null repo in a grant (2026-11-05)

Items: fix-handback-after-return (dropped), fix-grant-null-repo (ready). Two-way doors, decided by the thread that
took fix-handback-after-return as the person's stand-in.

## What the run shows

fix-blocked-retry's real run (tournaments/2026-11-04-stage-contract/trials/blocked-retry/) has one `sent-back` row per
agent for runs `trial:1.build`, `trial:3.build` and `trial:5.verify`, and its report read them as handbacks refused
after an accepted return. The run's own capture orders them the other way. For `trial:1.build`
(journal/sessions/c11cb991-....jsonl and journal/items/trial.jsonl):

| at (2026-11-05) | row |
|---|---|
| 14:54:42.029 | item `refusal` rule `sent-back`, tool SubagentHandback, `toolu_01VRojbg...` |
| 14:54:43.287 | session `tool.call` ToolSearch (loads the return tool) |
| 14:54:46.184 | item `result.stored`, return `toolu_01AmMbtk...` |
| 14:54:50.106 | session `tool.call` SubagentHandback `toolu_01PGsrNF...`, let through |

`trial:3.build` (refusal 14:55:35.958, ToolSearch 14:55:39.519, result 14:55:41.408, handback 14:55:47.597) and
`trial:5.verify` (refusal 14:56:14.625, ToolSearch 14:56:18.150, result 14:56:21.646, handback 14:56:25.964) are the
same. Each agent handed back first, was sent back once, loaded the return tool, returned, and handed back again, and
the second handback went through. `sent-back.json` in each run folder was written at the first handback. The brief
agent (`trial:0.brief`) loaded the tool and returned first, so it has no row.

## Decisions

1. **Drop fix-handback-after-return.** `handback()` sees an accepted result (`openRunOf` returns null once
   `result.json` exists), and no handback after a return was refused. The rows record real send-backs, so the
   Inspector and the refusal views are right to count them. Nothing in the engine changes.
2. **No item for the handback-first habit.** Three of four agents reach for SubagentHandback before the return tool,
   most likely because the platform's own reminder names SubagentHandback as how a subagent's report is delivered and
   the return tool is deferred. The send-back costs one turn of about four seconds and names the fix, and every agent
   returned on that turn. Moving the return line or rewording it would change the stage text the done suites and
   the stage bench pin, for a cost this small. If a run shows an agent that fails after the send-back, that is the
   item.
3. **Ready fix-grant-null-repo.** fix-blocked-card-grant's verifier found that a grant whose `repos` holds JSON `null`
   covers every card with no repository, because `standinInput()` asks `g.repos.includes(repo)` with `repo` null
   (main has it too). A grant check that matches "no repository" as a repository is a fail-open in the one check that
   lets a stand-in answer for the person. Grants are written by the person, so it needs a malformed grants file to
   bite, but the fix is one condition. A card with no repository is refused under every grant, with the same refusal
   text as today's no-repo refusal.
