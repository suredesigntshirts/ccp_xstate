# Plugin agents spike, headless half (2026-11-05)

The person asked whether our stage agents could live in the plugin, and asked for spike tests. Claude Code 2.1.318
ran headless in this container (`claude -p --plugin-dir <dir>`), with a throwaway plugin `spikeplug`:
`.claude-plugin/plugin.json`, `agents/probe-reader.md` (frontmatter `tools: Read, Glob`, `model: haiku`, and a body
asking it to start with a marker word), and hooks for PreToolUse on `Agent` and SubagentStart.

| Check | Result |
| --- | --- |
| Agent callable from a plugin | Yes, as `spikeplug:probe-reader` (namespaced by the plugin's name) |
| Body becomes the system prompt | Yes: the marker word appeared when the task prompt was only "go" |
| `tools` enforced | Yes: it had only Read and Glob, and could not create a file |
| `model` honoured | Yes: the session's usage shows claude-haiku-5-5 beside the main model |
| PreToolUse `updatedInput` swaps the prompt of a named-agent call | Yes, with `permissionDecision: allow`. Without it, headless `-p` denied the call |
| SubagentStart sees the named agent | Yes: `agent_type: "spikeplug:probe-reader"`, and its `additionalContext` reached the agent |

Two side facts:
- The installed ccp-harness plugin's own hooks also run in a headless session in this container, so a spike prompt of
  `ccp-run X` was refused (`unknown-run`). Use another marker in spikes.
- A `.mjs` hook script cannot use `require`. It fails silently, and the hook's output is lost.

Not shown: a marketplace-installed plugin, loaded at session start, in a Projects thread. That is item
`probe-plugin-agents`. Until it reports, the named-agent question in `stage-prompt-files` stays open.
