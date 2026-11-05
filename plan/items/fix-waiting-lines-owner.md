```json
{
  "id": "fix-waiting-lines-owner",
  "title": "List only the session's own waiting runs after a wake or an Agent call",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The context line the actor hooks add on UserPromptSubmit and PostToolUse of Agent names only the waiting runs of items the session owns, as the Stop guard does, so no session starts a run whose item another session owns.",
  "why": "fix-waiting-run-stall's verifier saw it in a real run (plan/decisions/2026-11-05-waiting-run-stall.md, After the build). plugins/harness/scripts/actors.mjs waitingRuns lists every item's prepared runs, whatever session owns the item, so a session told to start its own run also started another session's. The Stop guard already matches run.session to the hook input's session_id or sessionName; the lines do not.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-waiting-run-stall"
  ]
}
```

## What this is

Draft. A replan to ready decides whether spawn() should also refuse a `ccp-run` from a session that doesn't own the
run's item (wrong-session), or whether filtering the lines is enough. A refusal would also cover a model that copies a
run id from somewhere else.
