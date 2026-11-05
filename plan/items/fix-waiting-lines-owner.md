```json
{
  "id": "fix-waiting-lines-owner",
  "title": "List only the session's own waiting runs after a wake or an Agent call",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The context line the actor hooks add on UserPromptSubmit and PostToolUse of Agent names only the waiting runs of items the session owns, as the Stop guard does, so no session is told to start a run whose item another session owns.",
  "why": "fix-waiting-run-stall's verifier saw it in a real run (plan/decisions/2026-11-05-waiting-run-stall.md, After the build). plugins/harness/scripts/actors.mjs waitingRuns lists every item's prepared runs, whatever session owns the item, so a session told to start its own run also started another session's. The Stop guard already matches run.session to the hook input's session_id or sessionName; the lines do not. How each part is shaped is decided in plan/decisions/2026-11-05-waiting-lines-owner.md.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-waiting-run-stall"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js ownedWaiting, waiting, spawn, stall, cannotStart",
      "what": "ownedWaiting(root, sessions) (private) lists runs prepared, not started and not failed whose run.session is one of sessions; stall() and cannotStart() filter by it or by run.session; waiting(root, item) lists one item's runs for any session; spawn() takes session (the hook's session_id) but checks no owner"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "owners = [session_id, sessionName]; waitingRuns() reads every item's waiting(); PreToolUse of Agent calls cannotStart({ sessions: owners }) then spawn({ session: session_id })"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js",
      "what": "ownedWaiting(root, sessions) exported, returning { run, actor, prompt, item } per run, sorted by item then run, the runs stall() reads; spawn() unchanged"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "The UserPromptSubmit and PostToolUse-of-Agent lines come from ownedWaiting(root, owners); waitingRuns is gone; the line text is unchanged"
    },
    {
      "ref": "packages/engine/test/, plugins/harness/test/",
      "what": "The builder's tests: two items owned by two sessions, each session's lines name only its own runs; the cloud URL form owns its runs; a session owning nothing gets no line"
    },
    {
      "ref": "packages/engine/README.md, plugins/harness/README.md",
      "what": "The owner filter, where these describe the waiting lines"
    }
  ],
  "expect": [
    {
      "id": "lines-owned",
      "check": "Through the real hook script (plugins/harness/scripts/actors.mjs) on a journal root holding two items started from workflows/quick-fix.json by two sessions A and B, each with a run prepared and waiting: UserPromptSubmit and PostToolUse of Agent with A's session_id name A's run and not B's, and the same with B; a session owning neither gets no output; a run owned under the URL form is named when sessionName matches (CLAUDE_CODE_REMOTE_SESSION_ID set); on main the same input names both runs",
      "how": "The verifier's own test, run at the head and at main",
      "proof": "verifier"
    },
    {
      "id": "stall-unchanged",
      "check": "stall() and cannotStart() return and journal what main does for the same inputs, and the Stop hook's output is main's for the same journal root and hook input",
      "how": "The verifier's own test, run at the head and at main",
      "proof": "verifier"
    },
    {
      "id": "unchanged",
      "check": "No prompt or workflow changes: render() of every stage of every workflow is byte for byte main's and every workflow hash is main's; spawn() returns what main's does for the same inputs, through the hook too; every engine, plugin and verify test that passes on main passes, except plugins/harness/test/actors.test.mjs's assertion that session `sess` is named the next run of an item `s` owns, which is the behaviour this item reverses; the builder changes it to assert that `sess` gets no line and `s` gets the same line as main",
      "how": "node --test over packages/, plugins/ and verify/, and the diff against main",
      "proof": "verifier"
    },
    {
      "id": "real-session",
      "check": "In a real Claude Code session with the PR's harness plugin loaded (headless claude -p --plugin-dir, as fix-waiting-run-stall's verifier did), with one waiting run owned by this session and one owned by another, the session's hook context names only its own run, it starts only its own run (agent.spawn row for it, none for the other), and the other run stays waiting with no spawn.json",
      "how": "The verifier's own run, with the hook outputs read from the transcript and the rows from the journal",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No owner check in spawn(): a `ccp-run` of another session's run is still started, because done verifier suites (verify/engine-actor-returns) and the plugin's actor tests drive the hook from a session that doesn't own the item; see plan/decisions/2026-11-05-waiting-lines-owner.md, After the first build round",
    "No change to bin/host.js output or deliver()'s waiting list: both name one item's runs to its owner",
    "No handover of an item to another session when its owner has gone; the stall cap and cannot-start already move such an item on",
    "No prompt change, so no bench rerun and no workflow hash change"
  ],
  "records": [
    "The owner filter on the waiting lines"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "In a cloud container a headless claude -p inherits CLAUDE_CODE_REMOTE_SESSION_ID, so its sessionName is the parent thread's URL and it owns the parent's items too; the real-session line must own its runs under the child's session_id or account for this",
    "A model can still start another session's run from an id it copied from elsewhere; only the lines it is told are filtered"
  ]
}
```

## What this is

When a thread wakes or finishes an Agent call, a hook tells it which actor runs are waiting for their agent. Today it
lists every thread's waiting runs, so one thread started another thread's run. This item makes the list show only
the thread's own runs, as the Stop guard already does.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read the decision
plan/decisions/2026-11-05-waiting-lines-owner.md, and write your own tests under `verify/fix-waiting-lines-owner/`
without reading the builder's. Start two quick-fix items on the real engine as two sessions with `bin/host.js start
--session` until each has a run prepared (verify/fix-waiting-run-stall/lib.mjs shows how), then pipe hook inputs into
the real plugins/harness/scripts/actors.mjs with CCP_HARNESS_DIR at a harness folder (install.json + journal/), and read its
stdout. Run the same steps at main and show the lines differ, and that a `ccp-run` PreToolUse gets main's answer. For stall-unchanged, compare
stall(), cannotStart() and the Stop hook's output at the head and at main on the same roots. For unchanged, render
every stage of every workflow at both, compare hashes, run `npm test`, and read the diff. For real-session, run a
headless `claude -p --plugin-dir` session (pass `--session-id` so you know its id before it starts) with one run
owned by it and one owned by another id, and read the hook outputs from the transcript and the agent.spawn rows from
the journal. Break the fix (list every item's runs again) and show a builder test going red. Read the ci check at the
head sha. This container signs commits: commit any evidence holding commit shas with `GIT_CONFIG_GLOBAL=/dev/null git
-c commit.gpgsign=false commit`, or CI computes different shas. Commit `verify/fix-waiting-lines-owner/verdict.json`
with a verdict per Expect id.
