```json
{
  "id": "probe-plugin-agents-thread",
  "title": "Check the plugin's test agent in a real Projects thread on a release",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "ready",
  "outcome": "The first Projects thread that starts on a harness release shipping plugins/harness/agents/probe-reader.md shows, in its own session, that ccp-harness:probe-reader is listed and starts, with its tools, model and marker holding.",
  "why": "probe-plugin-agents proved plugin agents on the setup.sh install path with claude -p in a cloud container, but not inside a Projects thread: until 5 Nov 07:15Z new threads resumed a cached container holding 0.1.17 and skipped setup.sh (plan/research/probe-plugin-agents.md). The person re-saved the setup script then, and the thread that picked this item up started on harness-v0.1.24, the release that ships probe-reader. This closes the last step before stage roles move into the plugin.",
  "serves": [
    "L-plugins-load-at-start"
  ],
  "depends_on": [
    "probe-plugin-agents"
  ],
  "inputs": [
    {
      "ref": "plan/research/probe-plugin-agents.md",
      "what": "The checks and evidence to repeat inside a thread"
    },
    {
      "ref": "plan/decisions/waiting-for-person.md",
      "what": "The setup-script re-save this waits on"
    },
    {
      "ref": "plugins/harness/agents/probe-reader.md",
      "what": "The agent under test: tools Read and Glob, model haiku, marker QUILLMARROW"
    }
  ],
  "outputs": [
    {
      "ref": "plan/research/probe-plugin-agents.md",
      "what": "A section with the thread's session, release and results"
    },
    {
      "ref": "plan/research/probe-plugin-agents-thread/",
      "what": "Extracts of the thread's transcript (SessionStart line, agent listing, the Agent call and its result) and the subagent's transcript and meta.json"
    }
  ],
  "expect": [
    {
      "id": "thread-listed",
      "check": "A Projects thread whose SessionStart line names harness-v0.1.24 or later (a release that ships plugins/harness/agents/probe-reader.md) lists ccp-harness:probe-reader among its agent types, and an Agent call with that subagent_type starts it",
      "how": "The thread's transcript extract and the thread's capture journal on the shared mount (session.fingerprint release and plugin root, the Agent tool.call row), and the subagent's meta.json agentType",
      "proof": "world"
    },
    {
      "id": "thread-holds",
      "check": "The started agent runs on haiku, has only Read and Glob (a Write or Bash request is reported unavailable), and opens its reply with QUILLMARROW, which the task prompt does not give it",
      "how": "The subagent transcript: model on each assistant message, its tool calls, the prompt and the reply",
      "proof": "world"
    },
    {
      "id": "thread-report",
      "check": "plan/research/probe-plugin-agents.md has a section naming the thread's session, the release and each result, with the evidence path for each",
      "how": "The verifier reads the section against the committed extracts and the shared journal",
      "proof": "verifier"
    }
  ],
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No stage uses a named agent yet: moving stage roles into the plugin is a separate item",
    "No change to the plugin, the agent file or the workflow pin",
    "The prompt swap and SubagentStart binding are not re-run here: probe-plugin-agents proved them on the same release's code"
  ],
  "records": [
    "the thread's transcript extract and capture journal",
    "the subagent's transcript and meta.json"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 200000
  }
}
```

## What this is

The Projects-thread half that probe-plugin-agents could not reach. The person re-saved the setup script on 5 Nov at
07:15Z, and the next thread started on harness-v0.1.24 (its SessionStart: "ccp-harness 0.1.24 (harness-v0.1.24):
self-check passed"). That thread calls `ccp-harness:probe-reader` from its own session and commits extracts of what it
saw. The whole transcript is not committed: it holds the session's system prompt and project context.

## Verifier brief

You are a separate Projects thread, so you started on a release yourself. First note your own SessionStart line. Then:

1. Read `plan/research/probe-plugin-agents-thread/` and the builder thread's capture journal,
   `/mnt/project-files/harness/journal/sessions/<builder session>.jsonl` (the session the report names). Confirm the
   `session.fingerprint` row's release and plugin root, and the `tool.call` row for the Agent call with
   `subagent_type` `ccp-harness:probe-reader`.
2. Read the subagent transcript and meta.json extracts for thread-holds: model, tools used and refused, the marker,
   and that the task prompt lacks the marker.
3. If your own thread is on harness-v0.1.24 or later, repeat the call yourself (an Agent call with `subagent_type:
   "ccp-harness:probe-reader"` and a prompt that asks it to read `README.md` and to write a file), and read your own
   subagent files under `~/.claude/projects/`. This is your independent world check; commit your extracts under
   `verify/probe-plugin-agents-thread/evidence/`.
4. Read the report section against all of it for thread-report.

Commit `verify/probe-plugin-agents-thread/verdict.json` with a verdict per Expect id.
