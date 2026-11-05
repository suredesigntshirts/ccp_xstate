# Stage files: layout, pin, and named agents (2026-11-05)

Claude's two-way-door decisions as architecture lead, made when `stage-prompt-files` went ready. They follow
`plan/decisions/2026-11-05-stage-prompt-files.md`, which decided that stage prose moves to markdown files.

## Layout and format

- One file per model stage at `workflows/<workflow>/<stage>.md`, beside the workflow JSON, for example
  `workflows/quick-fix/brief.md`. A stage's meta.actors entry names it: `"prompt": "quick-fix/brief.md"` (a path
  relative to the workflow folder), and keeps only its output JSON Schema (types, required, oneOf, covers).
- The file mirrors the prompt's own parts: a `# <stage>` title, then `## Rules`, `## Inputs`, `## Output`, and
  `## Task` for a stage whose invoke takes a fixed task. Rules are `- <rule>` items; Inputs and Output are
  `- <name>: <text>` items. Each item is exactly one line, so a diff of one rule is a one-line diff and every prompt
  line has one file line. The Task is the lines under its heading, as written.
- No frontmatter. The JSON holds the wiring, schema, tools and everything the engine checks, so the file has nothing
  to declare; frontmatter would be a second place for wiring.
- Strict parsing: anything else in the file (another heading, prose outside a section, a name that is not an input or
  a property, Output out of the schema's property order, a Task no invoke uses) is refused at load, naming file and
  line. A lenient parser would let text silently drop out of the prompt.
- An invoke that takes the fixed task says so in the JSON: `"task": { "prompt": "task" }`. The wiring stays visible
  in the JSON; only the prose moves.

## Pin and replay

- The engine composes the JSON and its stage files into the spec it runs on today: rules, inputs, property
  descriptions and task literals filled back in, with `meta.prompts` mapping each filled JSON pointer to its file and
  line. render(), the chart, checkStages and replay are unchanged, so every prompt stays byte for byte the same.
- The pin hashes the composed spec's bytes (`JSON.stringify(spec, null, 2)` plus a newline), and that is what is
  stored as the blob. A blob alone replays an item, with no stage files; an edit to any stage file changes the pin.
  The alternative, a bundle of the raw files, would need a new blob format and the files to replay; it buys nothing.
- A workflow with no stage files (the test fixtures, every blob committed before this item) is pinned by its file
  bytes as before, so every committed journal and blob loads unchanged.

## Named agents: not used for stages

The person asked whether Claude Code's "named agents" are agents defined in `~/.claude/agents`, and whether we use them.
True: Claude Code reads custom subagent definitions from `~/.claude/agents/<name>.md` (the user's), `.claude/agents/`
(the project's) and a plugin's `agents/` folder. Each is a markdown file whose YAML frontmatter names it and may limit
its tools and set its model, and whose body becomes that subagent's system prompt. The Agent tool's `subagent_type`
picks one. We do not use them: every stage runs as the default agent, with its rules and task in one prompt.

From first principles, a named agent would buy three things: the role's standing rules in the system prompt rather
than the first message, a tool list Claude Code enforces, and a model per role. Against them:

- It is loaded when the session starts (L-plugins-load-at-start), and its version is the plugin release or the
  checkout, not the workflow pin. A run's record would no longer hold all of its instructions, a stage edit would take
  a release and a new thread to reach a run, and the bench would need a second path to load it.
- The split it offers already exists inside each stage file. Rules are the standing part (who the stage is, what it
  must not do, when to return); Task is what this run must do. The data rule ranks Rules above Task and every input.
- Tools are already limited by the harness hooks (confine() in actors.js), and the Agent tool takes a model per call.

So stages stay on the default agent, with one source of truth per stage: its file, pinned with its workflow. This is
revisited when the bench measures a criterion that improves with the Rules part in the system prompt (a bench variant
that passes it through `--append-system-prompt`), or a stage needs a tool limit the hooks cannot enforce. Adopting it
then means the PreToolUse hook sets `subagent_type` from the stage, and the agent file's hash joins the pin; whether
plugin agents load in cloud threads is checked then, not now.

## After the build (5 Nov)

Built in PR #107 and verified by a separate session (all 6 Expect lines MET at 4acdb33), then released as
harness-v0.1.23. The person then asked for spike tests on shipping agents inside the plugin, and the thread
"Refine stage prompts" owns that question. Its probe (`plan/research/probe-plugin-agents.md`, PR #109) found that plugin agents load on
the real install path, and that their tools, model and system prompt are enforced. Two conditions apply: a role's tools
must list the harness return tool, and the role file sits outside the workflow pin, so a stage file would name its
role and that file's sha256, and the PreToolUse swap would refuse on a mismatch. So the "not used" decision above
stands for this item only, and adopting roles is a separate item for that thread. The split stays as it is: the
stage's words in the stage file, and only tools and model in the agent file.
