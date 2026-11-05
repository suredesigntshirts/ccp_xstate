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
