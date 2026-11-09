# reader-answers

Clean clone of b467da6d5b029de53461e9d8ce479a0ad03fae71, `npm ci`, then per question, one run each, four at a time:
`node scripts/fresh-reader.mjs --cwd <clone> "Answer this question from the files of this repository alone. Name the file that answers it, and quote the lines you rely on.\n\nQuestion: <q>" -- --max-turns 25`. The prompt names no file and no term. Match: the answer text holds the question's home path and each carrying term, case and whitespace ignored.

| # | home | home named | terms missing | first file the answer names |
|---|---|---|---|---|
| 1 | docs/traps.md | yes | none | docs/traps.md |
| 2 | docs/traps.md | yes | none | docs/traps.md |
| 3 | docs/traps.md | yes | none | docs/traps.md |
| 4 | docs/traps.md | yes | none | docs/traps.md |
| 5 | docs/traps.md | yes | none | docs/traps.md |
| 6 | docs/verifying.md | yes | none | docs/verifying.md |
| 7 | docs/verifying.md | yes | none | docs/verifying.md |
| 8 | docs/verifying.md | yes | none | docs/verifying.md |
| 9 | plan/ledger/platform.md | yes | none | plan/ledger/platform.md |
| 10 | plan/ledger/platform.md | yes | none | plan/ledger/platform.md |
| 11 | plan/ledger/platform.md | **no** | none | plan/research/probe-plugin-agents.md |
| 12 | plan/ledger/platform.md | yes | none | plan/ledger/platform.md |

Question 11 was asked twice more: both answers again named only `plan/research/probe-plugin-agents.md`, never `plan/ledger/platform.md`. The first answer, cut:

```
**File:** `plan/research/probe-plugin-agents.md`

**Why a named stage agent can't load the return tool.** The file says:

> "**Its `tools` must name the return tool,** `mcp__plugin_ccp-harness_harness__return`, and every tool its stage uses (Bash for build and verify). A named agent with a `tools` list gets no ToolSearch, so a deferred tool it doesn't list is out of reach. `SubagentHandback` is always there."

So the agent has no ToolSearch to load the deferred return tool. The only way it can reach the tool is if the agent file's `tools` line lists it. The probe showed this failing:

```
