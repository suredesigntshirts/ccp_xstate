# Probe: agents shipped in the harness plugin (2026-11-05)

Plan item `probe-plugin-agents`. The headless half is `plan/decisions/2026-11-05-plugin-agents-spike.md`. This half
installs the plugin the way a cloud thread gets it and checks the agent there. Evidence is in
`plan/research/probe-plugin-agents/`.

**Verdict: stage roles can live in the plugin.** A test agent in `plugins/harness/agents/` loaded through the real
install path, was callable by its namespaced name, and Claude Code enforced its tools, model and system prompt. The
harness's prompt swap and SubagentStart binding worked unchanged, and the full return loop worked once the agent's
`tools` named the return tool. Two conditions follow, under "What a stage role needs".

## How it ran, and the gap

A fresh Projects thread could not be put on a new release. This thread is itself a fresh thread, started 06:25Z, and
its container resumed the cached image ("Fast resume ... Skipping initialization script", `/tmp/env-manager.log`), which
carries harness 0.1.17 from 3 Nov. Releases 0.1.18 to 0.1.22 never reached a thread for the same reason. A new thread
asked of the coordinator would get the same cached 0.1.17, so none was asked for. Getting a thread onto a newer release
needs the person to re-save the environment's setup script, which rebuilds the cache
(`plan/decisions/waiting-for-person.md`).

So the checks ran on the closest path a thread can reach, in this cloud container with Claude Code 2.1.318:

1. `infra/cloud-environment/setup.sh` installed the plugin into a fresh `HOME` (`/home/user/probehome`), exactly as it
   installs a release, with `CCP_SETUP_REF` at the build commit `407085b` (`installed-release.json`). The released
   files at the merge are the same files.
2. `claude -p` started in that `HOME` with **no `--plugin-dir`**. It loaded the plugin at session start from
   `~/.claude/skills/ccp-harness` as `ccp-harness@skills-dir`, the source a thread's session shows. The synced account
   plugins loaded beside it, as in a thread.
3. The harness hooks were live: `CCP_HARNESS_DIR=/home/user/probe-harness` held an `install.json` marker, and
   `packages/engine/bin/host.js start` had prepared quick-fix runs there.

What this does not show is the thread wrapper itself (the Projects session that a person opens). Claude Code, its
plugin loader, the container and the account's synced plugins were the same; only the entry point (`-p` versus a
remote session) differed.

## The checks

| Expect | Result | Session and evidence |
| --- | --- | --- |
| listed | **Held.** The session's init lists `ccp-harness:probe-reader` among its agents. An Agent call with that `subagent_type` started it | `run1/session.json` (session `5d344287-…`, `init.agents`, `init.plugins`); `run1/agent-a3b3ef88f4dcb5430.meta.json` has `agentType: "ccp-harness:probe-reader"`, `isBuiltIn: false` |
| holds: tools | **Held.** It read `README.md`, and could not create a file: "My toolset has no Write tool and no shell or Bash tool". Its tools were Read, Glob and `SubagentHandback` (Claude Code adds the handback tool to every subagent) | `run1/agent-a3b3ef88f4dcb5430.jsonl`, `run1/session.json` `result` |
| holds: model | **Held.** Every assistant message in the subagent transcript is `claude-haiku-5-5`; the session's `modelUsage` has haiku beside the main sonnet. `meta.json`'s `pickedEffortModel` says the main model and is wrong for a named agent: read the transcript | `run1/agent-a3b3ef88f4dcb5430.jsonl`, `run1/session.json` |
| holds: system prompt | **Held.** The reply opens with `QUILLMARROW`, which only the agent file's body gives; the task prompt (`run1/prompt.txt`) does not | `run1/agent-a3b3ef88f4dcb5430.jsonl` |
| harness-works: swap | **Held.** The Agent call with `subagent_type: "ccp-harness:probe-reader"` and prompt `ccp-run probe-agents-1:0.brief` started the agent with the run's brief: its first user message equals `brief.md` byte for byte (sha256 `06c0ebfa…`, the run's `briefHash`). `spawn.json` names the call | session `27f57a32-…`: `run2/session.json`, `run2/run-folder/spawn.json`, `run2/run-folder/brief.md`, `run2/agent-adf23bd71ee770b45.jsonl` |
| harness-works: binding | **Held.** SubagentStart bound the agent: the `agent.spawn` row has `type: "ccp-harness:probe-reader"`, `via: "start"`, the run and the brief hash | `run2/item.jsonl`, `run2/run-folder/agent.json` |

The run in `run2` then failed, as it should: the probe agent's `tools` had no return tool, so it could not return.
The harness sent it back once (`sent-back`) and failed the run at its next stop (`no-return`), both in `run2/item.jsonl`.

## Beyond the Expect lines: the full loop

A second agent file, `probe-returner` (`run3/probe-returner.md`, added only to the probe's installed copy, not
committed to the plugin), was the same with `tools: Read, Glob, mcp__plugin_ccp-harness_harness__return`. With prompt
`ccp-run probe-agents-2:0.brief` (session `55fad843-…`) it was bound, wrote both briefs and returned them; the hook
accepted the result. `run3/item.jsonl` has `agent.spawn` (type `ccp-harness:probe-returner`), `result.stored`, and the
builder and verifier `brief.stored` rows.

## What a stage role needs

- **Its `tools` must name the return tool,** `mcp__plugin_ccp-harness_harness__return`, and every tool its stage uses
  (Bash for build and verify). A named agent with a `tools` list gets no ToolSearch, so a deferred tool it doesn't
  list is out of reach (`plan/ledger/platform.md`, L-named-agent-tools). `SubagentHandback` is always there.
- **Its version must be tied to the workflow pin.** An agent file loads with the plugin at session start, from the
  installed release, while the workflow pin is the sha256 of the composed workflow (`stage-prompt-files`). The two
  can drift: a session on an old release would start a role whose file no longer matches the stage. The simplest tie
  is for the stage file to name its role and the sha256 of the role's agent file, the pin to cover that line, and the
  PreToolUse swap to refuse (`role-mismatch`) when `${CLAUDE_PLUGIN_ROOT}/agents/<role>.md` hashes differently. The
  agent file then carries only what Claude Code enforces (tools, model) and a short fixed body; the stage's words stay
  in the stage file and reach the agent through the swapped brief, as today.

## Side facts

- A headless child started from a thread inherits `CLAUDE_CODE_REMOTE_SESSION_ID`, so its rows' `hookSession` name the
  parent thread's session, not the child's. Read the child's own `session_id` from the hook input or the transcript.
- In `-p` mode the named agent can run in the background: in `run3` the parent's first result said it was still
  running, and the final result came after it finished.

## The release

PR #109 merged as `e9b6ae3` and was released as `harness-v0.1.24` (a release branch; the only changed released file
was `plugins/harness/agents/probe-reader.md`). `setup.sh` installed that release into a fresh `HOME`, and a `claude -p`
session there with no `--plugin-dir` (session `3119065a-c41b-41bb-bf06-6ed3a1786c82`) loaded `ccp-harness@skills-dir`
version 0.1.24 and listed `ccp-harness:probe-reader`. The verifier's evidence is in `verify/probe-plugin-agents/`. The
Projects-thread step waits for a setup-script re-save, as draft item `probe-plugin-agents-thread`.

## In a real Projects thread (probe-plugin-agents-thread)

The person re-saved the setup script at 07:15Z on 5 Nov. The next thread, "Check plugin agents in a real thread"
(session `cse_01KfkB5FmDxfpGGozgmjnWGN`, local transcript `3a5752f4-e169-53c2-93c9-b76f24d5aa4f`, Claude Code
2.1.318), started at 07:16Z on harness-v0.1.24, the release that ships `agents/probe-reader.md`. From its own session
it made one Agent call with `subagent_type: "ccp-harness:probe-reader"` (tool use `toolu_01R8dcCA6pJMxQA5VMoTsx5a`),
asking it to read `README.md`, write a file and run `whoami`. Evidence is in `plan/research/probe-plugin-agents-thread/`,
and the thread's capture journal is `/mnt/project-files/harness/journal/sessions/session_01KfkB5FmDxfpGGozgmjnWGN.jsonl`
(rows copied to `journal-extract.jsonl`).

| Expect | Result | Evidence |
| --- | --- | --- |
| thread-listed: release | **Held.** SessionStart: `ccp-harness 0.1.24 (harness-v0.1.24): self-check passed (7 of 7 checks)`. The journal's `session.fingerprint` row has release 0.1.24, tag `harness-v0.1.24`, commit `e9b6ae3`, root `/root/.claude/skills/ccp-harness` | `thread-transcript-extract.jsonl` lines 5–6 of the transcript; `journal-extract.jsonl` |
| thread-listed: listed and starts | **Held.** The thread's agent listing names `ccp-harness:probe-reader` with "(Tools: Read, Glob)". The call started it: `meta.json` has `agentType: "ccp-harness:probe-reader"`, `isBuiltIn: false`, `finished: true`; the journal has `agent.spawn` with that type from SubagentStart | `thread-transcript-extract.jsonl` (the `agent_listing_delta` attachment, the Agent tool_use and its result); `agent-a399d257145231f6c.meta.json`; `journal-extract.jsonl` |
| thread-holds: model | **Held.** All 3 assistant messages in the subagent transcript are `claude-haiku-5-5`, the `prefix.json` model is haiku, and the journal's `agent.finish` row has model `claude-haiku-5-5`, while the thread runs opus. `meta.json`'s `pickedEffortModel` again names the main model | `agent-a399d257145231f6c.jsonl`, `.prefix.json`, `journal-extract.jsonl` |
| thread-holds: tools | **Held.** `prefix.json` `toolNames` is `Read, Glob, SubagentHandback`. The agent called only Read and Glob, and reported the write and `whoami` not done: "I have no Write or Edit tool", "I have no Bash or shell tool" | `agent-a399d257145231f6c.prefix.json`, `.jsonl` |
| thread-holds: marker | **Held.** Its handback opens with `QUILLMARROW`; the task prompt (first user message of the subagent transcript, and the Agent tool_use input) does not contain it | `agent-a399d257145231f6c.jsonl`, `thread-transcript-extract.jsonl` |

The read itself failed because the repo has no root `README.md`; the agent said so and listed what Glob found, which
is the honest behaviour its body asks for. It does not bear on any check.

The subagent transcript is committed with its `attachment` rows removed (session context, environment and MCP
instructions the platform injects); its `user` and `assistant` rows are unchanged. The thread transcript is committed
as an extract only (`plan/decisions/2026-11-05-probe-plugin-agents-thread-ready.md`).

Side fact: in a thread, the capture hooks record named agents with no extra code: `agent.spawn` carries the agent type
and `agent.finish` the model the agent actually ran on, so the journal alone shows a role ran on its frontmatter model.
`prefix.json` does list the subagent's tool names.

So the plugin-agent path holds in a real Projects thread on a release, and the verdict above stands: stage roles can
live in the plugin, under the two conditions in "What a stage role needs".
