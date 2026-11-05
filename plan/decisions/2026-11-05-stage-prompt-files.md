# Stage instructions move to markdown files (2026-11-05)

The person asked why prompts live in workflow JSON when Claude Code and Codex keep instructions in markdown files
(`.claude/agents/*.md`, `SKILL.md`, `CLAUDE.md`, `AGENTS.md`), and how prompts reach the model. This is Claude's
two-way-door decision as architecture lead.

How prompts reach the model today: the engine renders a stage's prompt from the workflow JSON into
`runs/<n>.<actor>/brief.md`. The hosting session calls the Agent tool with `ccp-run <run>`, and the harness's
PreToolUse hook swaps in `brief.md`. The SubagentStart hook adds `context.md`, and the result comes back through the
harness return tool. A subagent still inherits Claude Code's system prompt and the environment's ambient instructions.
The bench runs the same `brief.md` through `claude -p`.

## Decision

- Each stage's prose (its rules, input meanings, output field descriptions, the brief's task) moves to one markdown
  file per stage beside its workflow. The JSON keeps the wiring and the schemas, and names each file by path.
  Item: `stage-prompt-files`.
- Claude Code's `.claude/agents` definitions are not used for stages. They load only at session start, they are not
  covered by the workflow pin, and each run's inputs must be filled in at run time anyway.
- It lands before `wf-intake` and `refine-brief-stage`, so their prompt work is done in the files.

## Follow-ups (5 Nov, later)

- **Named agents.** Claude Code agent definitions (`~/.claude/agents`, `.claude/agents`, a plugin's `agents/`) put
  a role's standing rules in the system prompt and enforce its tools and model. Stages do not use them today: every
  stage is the default agent with rules and task in one prompt. The stage-prompt-files replan decides whether the
  plugin ships a few roles (builder, verifier, writer) for tools and model, with stage files holding the
  task-specific rules. It must check that plugin agents load in cloud threads and how a role's version is tied to
  the workflow pin. Settled: not used, in `plan/decisions/2026-11-05-stage-prompt-files-ready.md`.
- **Stalled runs.** A prepared run waits on the thread's Claude calling the Agent tool. Draft item
  `fix-waiting-run-stall` blocks a Stop while a run waits. Headless stage processes (`claude -p`, as the bench runs
  them) would remove that dependence entirely; they are weighed once the bench has measured their cost.
