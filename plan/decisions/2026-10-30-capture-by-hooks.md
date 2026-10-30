# Capture by settings hooks, not a mod

**Date:** 2026-10-30, by the obs-live-capture thread, on the person's standing instruction to decide two-way doors and
not wait.

**The item asked for** "plugins/harness/hooks/capture (mod module, with a hooks fallback)".

**What was seen** (a `claude -p` session on Claude Code 2.1.314 with a plugin logging every hook's input, recorded as
`plugins/harness/test/fixtures/capture/`):

- PostToolUse carries `tool_use_id`, `duration_ms` and, inside a subagent, `agent_id` and `agent_type`; the main
  session's calls carry no `agent_id`. That is the attribution the item wants, with no guessing.
- SubagentStart carries the new agent's id and type. The agent's transcript, whose first line is the brief, and a
  `meta.json` naming the spawning tool use id already exist when it runs. SubagentStop carries the agent's
  transcript path, from which its tokens, time and final answer (its SubagentHandback message) are read.
- UserPromptSubmit carries the prompt (the wake) and Stop the transcript path (turn tokens).
- Mods a thread writes load only after the person turns them on in each session
  (plan/decisions/2026-10-30-setup-script-vs-sessionstart.md), and a mod's hooks see the same calls.

**Choice:** capture ships as settings hooks in the harness plugin (`scripts/capture.mjs`, handlers in
`scripts/capture-rows.mjs`), on every session the setup script builds. No mod module is built now. If a later item
needs a mod (engine-host), it can import `capture-rows.mjs`, whose handlers take a hook-shaped input and write nothing.

**Why:** the hooks carry every field the rows need and run without the person, so the "fallback" covers everything;
a mod would add a second path that only runs where the person has switched mods on.

**What it costs:** one node process per tool call (about 40 ms measured on the project files mount, median, from
process start), and cost and the 5-hour and 7-day usage windows, which reach no hook. `turn.usage` carries them as
null with a placeholder. Reversible: a mod can replace the hook entry at any time.

**Where:** the entry and handlers sit in `scripts/` beside the other hooks, not in a `hooks/capture/` folder as the
item's output line named, because the env-bootstrap verifier's test reads every hook command as `scripts/<file>`.
