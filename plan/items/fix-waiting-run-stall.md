```json
{
  "id": "fix-waiting-run-stall",
  "title": "Keep the hosting thread from ending a turn while a run waits for its agent",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "When the session that owns an item ends a turn while one of the item's actor runs is prepared and has no agent, the harness's Stop hook blocks the stop with the exact Agent call to make, at most twice per run by its own count in the journal; a third stop fails the run so the item takes its error path; the thread can fail a run it cannot start by saying why; and a derived view reports how often runs stall and whether a block led to a spawn.",
  "why": "Today the engine prepares a run, and a hook adds a line to the thread's context naming the Agent call to make, but nothing forces the call. A thread that ends its turn instead leaves the run waiting until something else wakes it. The person asked on 5 Nov what hooks could make the thread move more deterministically, and then for a guard that keeps its own count of blocks per run, has a fail exit, and measures how often stalls happen. Claude Code's Stop hook can block a stop with a reason that becomes the next instruction; its stop_hook_active flag only marks a stop that follows a block, so it does not count across turns. The harness registers a Stop hook already, but only for capture. How each part is shaped is decided in plan/decisions/2026-11-05-waiting-run-stall.md.",
  "serves": [
    "L-never-idle-on-person",
    "L-handback-without-return"
  ],
  "depends_on": [
    "engine-actors"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js waiting, spawn, prepare, fail, deliver",
      "what": "A run's folder (run.json with session = the item's owner, spawn.json once its Agent call is made, failed.json, result.json); waiting() lists runs with run.json and no spawn.json; spawn() reads the `ccp-run <run>` marker; a failed run becomes the invoke's error event through resultsOf and deliver"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs, plugins/harness/hooks/hooks.json",
      "what": "The actor hooks: PreToolUse of Agent calls spawn(); SubagentStop blocks with {decision:'block', reason}; the Stop event has only capture.mjs registered"
    },
    {
      "ref": "plugins/harness/scripts/host.mjs sessionName",
      "what": "A session as the journal names it: the cloud URL from CLAUDE_CODE_REMOTE_SESSION_ID, else the hook input's session_id"
    },
    {
      "ref": "packages/journal/bin/derive.js, packages/journal/src/derive/",
      "what": "The derived views on the command line (time, rework, overhead), each printing JSON"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "briefing, building, verifying and reverifying invoke stages whose onError goes to replanning, a card in front of the person"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js",
      "what": "stall({ root, session, sessions }) for a Stop: the runs prepared, not started and not failed whose run.session is one of `sessions`; each such run already blocked STALL_CAP (2) times fails now (failed.json why starting `stalled:`, a refusal row rule stall-cap outcome failed); the first such run blocked fewer times gets a `refusal` row (rule stall, outcome blocked, payload count, cap, run, actor, hookSession, textHash) and the block. Returns { block: reason or null, failed: [runs] }, or null with no such run. The reason names the item, its state, the run, its actor, the exact prompt `ccp-run <run>`, `Block <n> of 2.`, and the exit `ccp-cannot-start <run>: <why>`. cannotStart({ root, prompt, sessions }) reads `ccp-cannot-start <run>: <why>`: null for any other prompt, a deny for an unknown, started or failed run or a run another session owns (wrong-session), else fails the run (why `cannot-start: <why>`, a cannot-start row) and returns { deny, failed }. waiting() leaves out failed runs; spawn() refuses a failed run already-failed"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs, plugins/harness/hooks/hooks.json",
      "what": "Stop runs actors.mjs (after capture): a block answers {decision:'block', reason}; failed runs are delivered to their items. PreToolUse of Agent tries cannotStart before spawn, denies with its text, and delivers the failed run"
    },
    {
      "ref": "packages/journal/src/derive/stalls.js, packages/journal/bin/derive.js stalls --journal <file|root>",
      "what": "The stalls view as JSON: { prepared, blocked, blocks, startedAfterBlock, failedAtCap, cannotStart, rate, runs: [{ run, item, actor, blocks, startedAfterBlock, failed }] }, rate = blocked / prepared (0 with none prepared)"
    },
    {
      "ref": "packages/engine/test/, plugins/harness/test/, packages/journal/test/",
      "what": "The builder's tests of the block, the cap, cannot-start, the session filter and the view"
    },
    {
      "ref": "packages/engine/README.md, plugins/harness/README.md, docs/journal.md",
      "what": "The stall guard, its rows and the stalls view, where these describe the actor hooks and derived views"
    }
  ],
  "expect": [
    {
      "id": "block",
      "check": "With a quick-fix item started through the real host as session S and its brief run prepared, the plugin's actors.mjs given a Stop hook input with session_id S answers a block whose reason holds the item, its state, the run id, the actor, `ccp-run <run>`, `Block 1 of 2.` and `ccp-cannot-start`; the item's file gains a refusal row rule stall with count 1 and cap 2; the same input with session_id T (not the owner) and one after the run's Agent call was made (spawn.json) give no output and no row; the cloud form (CLAUDE_CODE_REMOTE_SESSION_ID set, run.session the URL) blocks too",
      "how": "The verifier's own test, running plugins/harness/scripts/actors.mjs as a child process with CCP_HARNESS_DIR at a temp install",
      "proof": "verifier"
    },
    {
      "id": "cap",
      "check": "A second Stop for the same waiting run blocks with count 2, with stop_hook_active true or false; a third gives no block and fails the run: failed.json's why starts `stalled:`, a stall-cap row is journalled, the item is in replanning (the invoke's onError) when shown through bin/host.js, waiting() no longer lists the run and `ccp-run <run>` is refused already-failed; a session with two waiting runs blocks on one at a time, and the count of one run does not use up the other's",
      "how": "The verifier's own test on the real engine and hook",
      "proof": "verifier"
    },
    {
      "id": "cannot-start",
      "check": "A PreToolUse of Agent from the owning session with prompt `ccp-cannot-start <run>: no Agent tool here` is denied, failed.json's why is `cannot-start: no Agent tool here`, a cannot-start row is journalled and the item is in replanning; the same prompt from another session is refused wrong-session and changes nothing; for an unknown, started or failed run it is refused and changes nothing; a later Stop does not block on the failed run",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "measure",
      "check": "derive.js stalls over a journal with known runs (one never blocked, one blocked once then started, one failed at the cap, one cannot-start) prints prepared 4, blocked 2, blocks 3, startedAfterBlock 1, failedAtCap 1, cannotStart 1 and rate 0.5, with a per-run entry for each",
      "how": "The verifier's own journal and run of packages/journal/bin/derive.js",
      "proof": "verifier"
    },
    {
      "id": "unchanged",
      "check": "No prompt text changes: render() of every stage of every workflow in workflows/ is byte for byte main's and every workflow's hash is main's; every engine, journal, plugin and verify test that passes on main passes, and any assertion changed in packages/ or plugins/ tests reads only the failed-run filter of waiting() or spawn(), or the Stop registration",
      "how": "node --test over packages/, plugins/ and verify/, and the diff of the tests against main",
      "proof": "verifier"
    },
    {
      "id": "real-session",
      "check": "In a real Claude Code session with the PR's harness plugin loaded (claude -p with --plugin-dir and --session-id S), with a quick-fix item started as S and its brief run waiting, a prompt that tells the model to reply ok and end its turn ends with the stop blocked and the model making the Agent call with `ccp-run <run>`: the item's file has a stall row and then the run's agent.spawn row; a second session with the Agent tool disallowed ends after two blocks with the run failed at the cap and the item in replanning; derive.js stalls over that journal reports both runs as blocked, one started after a block and one failed at the cap",
      "how": "The verifier's own runs, with the item's journal rows and the sessions' transcripts read after",
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
    "adds": [
      "stall guard"
    ],
    "budget": 1
  },
  "non_goals": [
    "No prompt change: stage files and returnLine stay as they are, so no bench rerun and no workflow hash change",
    "No change to the UserPromptSubmit and PostToolUse lines that list waiting runs",
    "No card from the hook: past the cap the workflow's own onError puts the item in front of the person",
    "No launching of stages as headless processes; that is weighed after the bench shows its cost"
  ],
  "records": [
    "a refusal row with rule stall (outcome blocked, count, cap) for every block",
    "a refusal row with rule stall-cap, and the run's failed.json, when a run fails at the cap",
    "a refusal row with rule cannot-start, and the run's failed.json, when the thread fails a run it cannot start"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A Stop that blocks when the thread had good reason to stop: two blocks then a failure that puts the item in front of the person bounds it, and the exit lets the thread say why at once",
    "A model that answers a block by ending again: the cap and the stall-cap failure bound it at three stops",
    "A run the session owns but means to start later, in another turn: there is no such case in the workflows today, since a prepared run's agent is the next thing to start; the stalls view shows it if one appears",
    "In a Projects thread the guard is proven only through claude -p; the first real stall there shows in the stalls view"
  ]
}
```

## What this is

The engine prepares an actor's run and a hook names the Agent call to make, but nothing makes the thread make it. This
item adds a Stop check for the session that owns the item: a turn that ends with one of its runs waiting is sent back
with the exact call, twice at most, counted in the journal; a third stop fails the run so the item takes its error
path and comes in front of the person. A thread that cannot start a run says why with `ccp-cannot-start`, which
fails the run with that reason. A derived view counts how often runs stall, and whether a block led to a spawn.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read the decision
plan/decisions/2026-11-05-waiting-run-stall.md, and write your own tests under `verify/fix-waiting-run-stall/`
without reading the builder's. Start a quick-fix item with `packages/engine/bin/host.js start` as a session id you
choose, with a temp `--root` and `--repo`, so its brief run is prepared, then run `plugins/harness/scripts/actors.mjs`
as a child process with CCP_HARNESS_DIR pointing at a temp harness folder holding install.json and the journal, and
feed it Stop and PreToolUse hook inputs on stdin (the verifiers of fix-reminder-wake and fix-refusal-hints show the
pattern). For block, cap and cannot-start, read the hook's stdout, the run's folder and the item's rows, and show
the item through `bin/host.js show`. For measure, build a journal whose rows you choose and run
`packages/journal/bin/derive.js stalls`. For unchanged, render every stage of every workflow at the head and at
main and compare, compare hashes, run `npm test`, and read the diff of the tests against main. For real-session, run
headless `claude -p --plugin-dir plugins/harness --session-id <uuid>` in your own container with the item started as
that uuid (the stage-bench and probe-plugin-agents verifiers show how), once plainly and once with
`--disallowedTools Agent`, then read the rows and transcripts. Break the cap (never fail) and the session filter
(block on any session's run) and show a builder test going red for each. Read the ci check at the head sha. Commit
`verify/fix-waiting-run-stall/verdict.json` with a verdict per Expect id.
