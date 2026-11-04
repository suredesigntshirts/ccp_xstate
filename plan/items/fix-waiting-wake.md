```json
{
  "id": "fix-waiting-wake",
  "title": "Schedule a wake for an item waiting on the person",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "An item waiting on a person's card has a timer set, so a wake is scheduled for it, while other items advance on their own.",
  "why": "parity-cases found quick-fix's awaitingMerge and replanning set no timer, so nothing wakes an item that waits on a card; other items do advance, being separate files (plan/decisions/2026-11-01-parity-cases-gaps.md). feature's replanning and research's awaitingPublish and replanning ask the person the same way. Done when packages/engine/test/parity/C-waiting-does-not-stall.test.js passes and its gaps.json entry is gone; the parity-cases verifier's characterisation test verify/parity-cases/C-waiting-does-not-stall.gap.test.mjs asserts today's broken behaviour, so this item deletes it in the same PR. How each part is shaped is decided in plan/decisions/2026-11-04-waiting-wake.md.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "parity-cases"
  ],
  "cases": [
    "C-waiting-does-not-stall"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/host.js effectsOf, applyEvent",
      "what": "A delayed transition's timer becomes a timer effect keyed <item>:<seq>.<timer id> with its due time, and leaving its state a cancel effect; a fired timer is dropped from host.timers"
    },
    {
      "ref": "packages/engine/src/wake.js dueTimers",
      "what": "Any wake whose current-time is past a timer's due time fires it, with source timer"
    },
    {
      "ref": "packages/engine/src/effects/timer.js",
      "what": "The timer and cancel handlers over a clock (wakeAt, drop)"
    },
    {
      "ref": "packages/engine/bin/host.js",
      "what": "The command-line host, which passes only the run and stop handlers, so a timer or cancel effect stays pending for ever"
    },
    {
      "ref": "packages/engine/src/stages.js checkStages",
      "what": "The load check every workflow passes"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/feature.json, workflows/research.json",
      "what": "The states that invoke ask and set no timer: quick-fix awaitingGates, awaitingMerge, replanning; feature replanning; research awaitingPublish, replanning"
    },
    {
      "ref": "verify/parity-cases/C-waiting-does-not-stall.gap.test.mjs",
      "what": "The verifier's characterisation of the gap"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/quick-fix.json, workflows/feature.json, workflows/research.json",
      "what": "Every state that invokes ask has after.checkBack, a transition with no target and no actions, and meta.delays.checkBack is 3600000 (one hour)"
    },
    {
      "ref": "packages/engine/src/host.js refusal",
      "what": "A set timer's event is taken in its state even when its transition changes nothing (XState's can() says no to a transition with no target and no actions)"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "The load check refuses a workflow with a state that invokes ask and has no after transition, naming the state"
    },
    {
      "ref": "packages/engine/bin/host.js",
      "what": "Passes the timer and cancel handlers with no clock, so a timer effect ends with its due time and a cancel ends at once; the open timer and its due stay listed under pending.timers for the session to schedule its wake"
    },
    {
      "ref": "packages/engine/test/parity/C-waiting-does-not-stall.test.js",
      "what": "The case's parity test; its gaps.json entry and the verifier's gap test are removed"
    },
    {
      "ref": "packages/engine/README.md, docs/journal.md, scripts/toy-run.sh",
      "what": "The checkBack timer and how a session schedules its wake, where these name timers"
    }
  ],
  "expect": [
    {
      "id": "scheduled",
      "check": "Through the real engine and effect handlers over a recording clock, a quick-fix item that reaches awaitingMerge asks the clock for exactly one wake, keyed by its timer effect id and due one hour after the transition that entered the state, while an independent item advances to its own card; awaitingGates, replanning, feature's replanning and research's awaitingPublish and replanning each do the same; leaving the state by a tap or a push asks the clock to drop that key and leaves no timer open",
      "how": "The verifier's own test from the case text",
      "proof": "verifier"
    },
    {
      "id": "fires-holds",
      "check": "A wake whose current-time is before the due time fires nothing; a wake past it journals the timer's event with source timer, and the item stays in its state with its ask run open, its card not closed, no new card and no new timer; a tap on the card afterwards still moves the item (awaitingMerge to merging and done)",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "load-check",
      "check": "Loading a workflow with a state that invokes ask and has no after transition is refused with a message naming the workflow and the state; the three workflows in workflows/ load",
      "how": "Builder's test of the load check",
      "proof": "builder"
    },
    {
      "id": "parity",
      "check": "packages/engine/test/parity/C-waiting-does-not-stall.test.js passes, gaps.json lists no case, verify/parity-cases/C-waiting-does-not-stall.gap.test.mjs is gone, the parity listing test passes, and every tourney scenario passes; any scenario or engine test assertion changed reads only the new timer, its cancel or the workflow's hash",
      "how": "node --test packages/engine/test/ and the diff of packages/engine/test against main",
      "proof": "verifier"
    },
    {
      "id": "thread-wake",
      "check": "In a real thread: bin/host.js on a journal under /mnt/project-files takes a quick-fix item to its merge card, show lists the open checkBack timer with its due time and no timer or cancel effect pending, the thread schedules a wake for the due time (send_later), and the wake that arrives, fed to bin/host.js wake as a UserPromptSubmit hook input, fires the timer: the item's file has the timer row, the item is still awaitingMerge with the card up, and read_thread shows the card still open",
      "how": "The verifier's own run in its thread, with the rows and the thread read after",
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
    "No repeating timer: one wake per entry into a waiting state",
    "No move on a timer: silence is not an answer, so the item never leaves a waiting state because time passed; a stand-in answers only under a grant",
    "No post or reminder to the person when the timer fires"
  ],
  "records": [
    "engine.transition rows for each fired checkBack timer, source timer and the timer effect id",
    "engine.effect rows for each timer and cancel effect, start and done, in bin/host.js too"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The workflow change alters each workflow's sha256, so an item pinned to an older workflow keeps waiting with no timer until it finishes.",
    "A wake's time is clamped to the host's clock, so the thread-wake proof needs a real hour's wait for the scheduled wake.",
    "A session that does not schedule the wake bin/host.js lists leaves the item waiting; the host process has no clock of its own."
  ]
}
```

## What this is

An item waiting on the person's card sets no timer today, so if no other wake comes, the thread that holds it stays
quiet. This item gives every state that asks the person a one-hour `checkBack` timer that moves nothing: the wake it
asks for brings the thread back to the waiting item, and the load check keeps a new asking state from leaving it out.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read C-waiting-does-not-stall in
plan/cases/work-item.md and the decision plan/decisions/2026-11-04-waiting-wake.md, and write your own tests under
`verify/fix-waiting-wake/` without reading the builder's. Drive items on the real engine with `handlers()` from
packages/engine/src/effects over a thread client and a clock that record every card, close, wake and drop (the parity
world in packages/engine/test/parity/world.js or verify/parity-cases/gaps-lib.mjs is fine to reuse). For scheduled,
take a quick-fix item to awaitingMerge with a second item started beside it, and check the clock's one wake, its key
and its due time against the entering transition's row; do the same for awaitingGates and replanning, and for
feature's and research's asking states; then leave the state by a tap and, in a fresh item, by a push, and check the
drop. For fires-holds, offer wake text (the fixtures in packages/engine/test/fixtures/wakes/) with a current-time
before and after the due time, with `now` passed to `inputsOfWake` so the clamp lets it through, and check the rows,
the state, `pending()` and the thread client; then tap the card. For load-check, load a copy of quick-fix with one
`after` removed. For parity, run the engine tests and read the diff of packages/engine/test against main. For
thread-wake, use bin/host.js with `--root` under /mnt/project-files and stub agents (packages/engine/test/actors.test.js
or scripts/toy-run.sh show how), put the merge card up in your own thread with request_decision and record it with
`card`, schedule a wake with send_later for the due time `show` prints, and when it arrives feed it to `wake` as a
UserPromptSubmit hook input; read the item's rows and your thread. Break the load check (let a missing `after`
through) and show a builder test going red. Read the ci check at the head sha. Commit
`verify/fix-waiting-wake/verdict.json` with a verdict per Expect id.
