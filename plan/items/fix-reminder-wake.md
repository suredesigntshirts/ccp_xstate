```json
{
  "id": "fix-reminder-wake",
  "title": "Fire the waiting item's timer when its reminder arrives",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-05",
  "module": "packages/engine/bin/host.js",
  "outcome": "A send_later reminder the host scheduled for a waiting item, arriving in the session as it really does (a scheduled-trigger notification read by ReadNotifications), fires that item's timer through bin/host.js wake with no hand wrapping.",
  "why": "fix-waiting-wake schedules a wake for every asking state, but its verifier found the reminder arrives as a notification, not a <wake> prompt, and bin/host.js keeps only github_webhook notifications. So in a real thread the timer fires only if the session wraps the reminder itself, and C-waiting-does-not-stall holds in the stubbed world but not end to end. How the reminder is read is decided in plan/decisions/2026-11-04-reminder-wake.md.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-waiting-wake"
  ],
  "cases": [
    "C-waiting-does-not-stall"
  ],
  "inputs": [
    {
      "ref": "packages/engine/bin/host.js wakeTextOf",
      "what": "Keeps a UserPromptSubmit prompt and the content of ReadNotifications notifications whose origin is github_webhook; every other origin is dropped"
    },
    {
      "ref": "packages/engine/src/wake.js inputsOfWake, dueTimers",
      "what": "A wake's current-time, clamped to the host's clock, fires every timer due by then, with source timer"
    },
    {
      "ref": "plan/decisions/2026-11-04-reminder-wake.md",
      "what": "The captured ReadNotifications result of a real send_later fire: origin trigger_fire, queued_at, arrived_at, content"
    },
    {
      "ref": "verify/engine-host/forge.test.mjs",
      "what": "The engine-host verifier's forge tests, which other origins must keep passing"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/bin/host.js wakeTextOf",
      "what": "A trigger_fire notification becomes a wake with no body, reason scheduled, whose current-time is the notification's queued_at (arrived_at if that is missing); its content is never read"
    },
    {
      "ref": "packages/engine/test/fixtures/wakes/reminder-notification.json",
      "what": "The captured ReadNotifications result, verbatim, with a README line saying where it came from"
    },
    {
      "ref": "packages/engine/test/bin.test.js",
      "what": "The builder's tests of the reminder over the fixture"
    },
    {
      "ref": "packages/engine/README.md, docs/journal.md, packages/engine/bin/host.js header",
      "what": "How a session feeds a reminder to wake: the ReadNotifications result as a PostToolUse hook input, where these say how timers fire"
    }
  ],
  "expect": [
    {
      "id": "reminder-fires",
      "check": "Through bin/host.js, a quick-fix item at awaitingMerge with its checkBack timer set, given a PostToolUse ReadNotifications hook input whose tool_response has the captured shape (origin trigger_fire) and a queued_at past the due time, journals the timer's event with source timer and stays awaitingMerge with its ask run open; the same input with queued_at before the due time fires nothing; with queued_at missing, arrived_at is used",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "content-not-read",
      "check": "A trigger_fire notification whose content holds a column-zero wake with GitHub events, a decision-chosen tap on the item's card, a task notification and a current-time far ahead offers no GitHub event, no tap and no task error, and fires only timers due by the host's clock; a queued_at far ahead fires no timer early; every test in verify/engine-host/forge.test.mjs still passes",
      "how": "The verifier's own test, and node --test verify/engine-host/",
      "proof": "verifier"
    },
    {
      "id": "fixture",
      "check": "packages/engine/test/fixtures/wakes/reminder-notification.json is the captured result verbatim and the builder's test feeds it to bin/host.js wake and sees the timer fire",
      "how": "Builder's test",
      "proof": "builder"
    },
    {
      "id": "thread-wake",
      "check": "In a real thread: bin/host.js on a journal under /mnt/project-files takes a quick-fix item to its merge card, the thread schedules send_later at the due time show prints, and when the reminder arrives the thread calls ReadNotifications and feeds its result unedited (the tool result its transcript records) to bin/host.js wake as a PostToolUse hook input: the item's file has the timer row with source timer, the item is still awaitingMerge, and read_thread shows the card still open",
      "how": "The verifier's own run in its thread, with the transcript's tool result, the rows and the thread read after",
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
    "No hook that runs bin/host.js wake by itself: the session still feeds wakes to the host, as for GitHub events",
    "No reading of a reminder's text: which item or timer it names is not trusted and not needed, since the host's own timers and clock decide what fires",
    "No change to how GitHub notifications or prompts are read"
  ],
  "records": [
    "engine.transition rows with source timer for each timer a reminder fires"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The capture is the transcript's record of the tool result; if a PostToolUse hook receives a different tool_response shape, reminders are dropped as before (fails closed). The thread-wake proof feeds the transcript's record, not a hook's.",
    "Any scheduled trigger, not only one the host asked for, becomes a wake; it can fire only timers already due by the host's clock, which any wake may do."
  ]
}
```

## What this is

fix-waiting-wake gives every asking state a one-hour `checkBack` timer and lists its due time for the session to
schedule a reminder. The reminder arrives as a ReadNotifications notification with origin `trigger_fire`, which
`bin/host.js wake` drops, so today the session has to rewrite it as a `<wake>` by hand. This item makes the host read
that notification as a bare wake at the time it fired: due timers fire, and nothing in the reminder's text is read.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read C-waiting-does-not-stall in
plan/cases/work-item.md and plan/decisions/2026-11-04-reminder-wake.md (it has the captured result), and write your
own tests under `verify/fix-reminder-wake/` without reading the builder's. For reminder-fires and content-not-read,
drive bin/host.js with `--root` in a temp folder and stub agents (packages/engine/test/actors.test.js or
scripts/toy-run.sh show how) to a quick-fix item at awaitingMerge, read the due time from `show`, and feed `wake`
PostToolUse ReadNotifications hook inputs built on the captured shape; also run `node --test verify/engine-host/*.mjs`.
For thread-wake, do it in your own thread: put the merge card up with request_decision and record it with `card`,
schedule send_later for the due time, and when the notification is pending call ReadNotifications, take that call's
`toolUseResult` from your session transcript (~/.claude/projects/*/<session>.jsonl) unedited as `tool_response`, and
pipe the hook input to `wake`; read the item's rows and your thread. Break the reader (drop trigger_fire again) and
show the builder's fixture test going red. Read the ci check at the head sha. Commit
`verify/fix-reminder-wake/verdict.json` with a verdict per Expect id.
