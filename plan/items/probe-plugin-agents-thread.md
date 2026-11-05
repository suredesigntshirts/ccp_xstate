```json
{
  "id": "probe-plugin-agents-thread",
  "title": "Check the plugin's test agent in a real Projects thread on a release",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "draft",
  "outcome": "The first Projects thread that starts on a harness release shipping plugins/harness/agents/probe-reader.md shows, in its own session, that ccp-harness:probe-reader is listed and starts, with its tools, model and marker holding.",
  "why": "probe-plugin-agents proved plugin agents on the setup.sh install path with claude -p in a cloud container, but not inside a Projects thread: new threads resume a cached container holding 0.1.17 and skip setup.sh, so no release since reaches a thread (plan/research/probe-plugin-agents.md). This closes that last step once the person re-saves the setup script.",
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
    }
  ],
  "outputs": [
    {
      "ref": "plan/research/probe-plugin-agents.md",
      "what": "A section with the thread's session, release and results"
    }
  ],
  "expect": [
    {
      "id": "thread-listed",
      "check": "A Projects thread whose SessionStart names a release that ships the agent lists ccp-harness:probe-reader, and a call with that subagent_type runs on haiku with only Read and Glob and shows QUILLMARROW",
      "how": "The thread's transcript and the subagent's meta.json and transcript",
      "proof": "world"
    }
  ],
  "verifier": "A separate session reads the thread's transcript and subagent files."
}
```

## What this is

The Projects-thread half that probe-plugin-agents could not reach. Pick it up when a new thread's SessionStart line
shows a release at or after the one that ships `probe-reader`.
