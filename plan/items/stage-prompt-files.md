```json
{
  "id": "stage-prompt-files",
  "title": "Keep each stage's instructions in its own markdown file",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Each model stage's instructions (its rules, the meaning of each input, each output field's description, and the brief's fixed task) live in one markdown file per stage beside its workflow, which the workflow JSON names by path. The engine renders the same prompt from them, the workflow pin hashes them with the JSON, and the Inspector traces each prompt line to its file and line.",
  "why": "On 5 Nov the person, having read the prompt-refinement doc, pointed out that keeping prompts as strings inside workflow JSON is not how Claude Code or Codex do it. There, instructions are markdown files: .claude/agents/<name>.md, SKILL.md, CLAUDE.md, AGENTS.md. From first principles the person is right. A prompt is prose that people read, diff and edit; JSON strings hide it behind escaping, and a one-word change shows as a long changed line. Wiring and schemas stay JSON, because the engine checks them. Claude Code's own agent files are not used, because they load only at session start (L-plugins-load-at-start) and each run's inputs must still be filled in at run time (plan/decisions/2026-11-05-stage-prompt-files.md).",
  "serves": [
    "L-stage-needs-bench",
    "L-theory-written",
    "L-rules-in-spec-not-host"
  ],
  "depends_on": [
    "stage-bench"
  ]
}
```

## What this is

Draft. It comes before wf-intake and refine-brief-stage, so that new stages and rewritten rules are written in the
files from the start. A replan to ready decides the file layout (for example `workflows/quick-fix/<stage>.md`), its
frontmatter, how the pin covers the files, and how old journals still replay. The rendered prompt for every stage and
recorded input must stay byte for byte the same (the bench's same-prompt check).
