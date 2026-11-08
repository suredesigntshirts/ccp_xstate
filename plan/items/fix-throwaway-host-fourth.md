```json
{
  "id": "fix-throwaway-host-fourth",
  "title": "Throwaway: a fourth fix to host.js, to show the fix budget refuses it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "module": "packages/engine/src/host.js",
  "outcome": "When an item with an open card leaves the state that asked (a push, a red check, the item finishing or its PR merged by another path), the card is closed for the person and nothing about it stays waiting.",
  "why": "parity-cases found the host turns the left ask into a stop effect that no handler carries out, so the person's card stays up after the item has moved on, and quick-fix takes no event for its PR merged by another path (plan/decisions/2026-11-01-parity-cases-gaps.md). Since then quick-fix takes the merge (lane A Q7) but answers it with a second card. Done when packages/engine/test/parity/C-finish-closes-waits.test.js passes and its gaps.json entry is gone; the parity-cases verifier's characterisation test verify/parity-cases/C-finish-closes-waits.gap.test.mjs asserts today's broken behaviour, so this item deletes it in the same PR. How each part is shaped is decided in plan/decisions/2026-11-04-finish-closes-waits.md.",
  "serves": [
    "L-item-finish-clears-inbox"
  ],
  "depends_on": [
    "parity-cases"
  ],
  "cases": [
    "C-finish-closes-waits"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/host.js effectsOf, runEffects",
      "what": "The stop effect made when a state with an open run is left, and the loop that skips effect types with no handler"
    },
    {
      "ref": "packages/engine/src/effects/index.js, card.js, relay.js",
      "what": "The handlers runEffects is given (run, timer, cancel, no stop), the card made keyed by the ask run's effect id, and the command-line host's card record"
    },
    {
      "ref": "packages/engine/bin/host.js",
      "what": "The command-line host, which passes only the run handler and has a card command but no way to record a closed card"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "github.pull_request.closed, taken only when merged, sending the item to replanning and a new card"
    },
    {
      "ref": "plugins/harness/pages/observe/data.js itemView",
      "what": "An ask counts as open until it is answered, so a stopped ask waits for ever"
    },
    {
      "ref": "verify/parity-cases/C-finish-closes-waits.gap.test.mjs",
      "what": "The verifier's characterisation of the gap"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/host.js, packages/engine/src/effects/",
      "what": "A stop handler: a stopped ask run's card is closed through the thread client by the run's effect id, a card never made has nothing to close, and any other stopped run finishes at once; the stop effect names its run's actor"
    },
    {
      "ref": "packages/engine/src/effects/relay.js, packages/engine/bin/host.js",
      "what": "A closed-card record and a bin/host.js closed command; the stop of a recorded card waits for it, as a card waits for its card record; recording a card for a stopped run is refused with a message to withdraw it; the host passes the stop handler"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "github.pull_request.closed for the item's PR, merged or not, moves every state that holds the PR to a new final state closedOutside with failure.closedOutside and failure.outcome; never done"
    },
    {
      "ref": "plugins/harness/pages/observe/data.js",
      "what": "An ask whose stop effect is done is closed, not open, and its wait ends there"
    },
    {
      "ref": "packages/engine/test/parity/C-finish-closes-waits.test.js",
      "what": "The case's parity test; its gaps.json entry and the verifier's gap test are removed; tourney Q7 changed to expect closedOutside with no new card"
    },
    {
      "ref": "packages/engine/README.md, docs/journal.md, scripts/toy-run.sh",
      "what": "The closed command and the stop effect's outcome, where these name card and stop"
    }
  ],
  "expect": [
    {
      "id": "left-closes",
      "check": "Through the real engine and effect handlers over a recording thread client, a quick-fix item waiting on its merge card that is moved on by a push, by a red check, and (in a fresh item each) by its PR merged on GitHub and by its PR closed unmerged, has the card closed exactly once by its key, no stop effect left pending, and no ask run open; the merged and closed paths end in closedOutside, never done, with no new card made and no merge effect",
      "how": "The verifier's own test from the case text",
      "proof": "verifier"
    },
    {
      "id": "nothing-else-held",
      "check": "A stopped agent run (a verify run left by a push) finishes its stop at once with nothing closed, a stop of an ask whose card was never made finishes with nothing closed, and a tap on a closed card moves nothing",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "parity",
      "check": "packages/engine/test/parity/C-finish-closes-waits.test.js passes, gaps.json no longer lists the case, verify/parity-cases/C-finish-closes-waits.gap.test.mjs is gone, the parity listing test passes, and every tourney scenario passes; the only scenario assertions changed are Q7's (it now ends closedOutside) and Q2's stop check (which read an agent run's stop as pending for ever, and now reads it done)",
      "how": "node --test packages/engine/test/parity/ packages/engine/test/tourney/ and the diff of those folders",
      "proof": "verifier"
    },
    {
      "id": "view-closed",
      "check": "The observe item view shows the stopped ask closed, with its wait ending at the stop, not at now",
      "how": "Builder's test of itemView over the rows of a stopped ask",
      "proof": "builder"
    },
    {
      "id": "thread-card",
      "check": "In a real thread: bin/host.js on a journal under /mnt/project-files takes a quick-fix item to its merge card, the thread puts the card up with request_decision and records it with bin/host.js card, a pull_request.closed wake moves the item to closedOutside, show lists the stop as pending, the thread withdraws the card with close_decision and runs bin/host.js closed, and the next call finishes the stop; read_thread then shows the card withdrawn",
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
    "No cancelling of a child item when its parent's state is left; its stop finishes at once and the child keeps its own cards",
    "No post telling the person an item ended outside the host; the health check reports the merge",
    "No change to what C-merge-outside-host-detected lists"
  ],
  "records": [
    "engine.effect rows for each stop, start and done, with outcome { closed: <card id> } or { closed: null }"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The workflow change alters quick-fix's sha256, so an item pinned to the old quick-fix keeps the replanning answer to a merge elsewhere until it finishes; the stop handler still closes its card.",
    "A card the thread put up but never recorded before the stop cannot be found by the host; the card command's refusal tells the thread to withdraw it."
  ]
}
```

Throwaway item for the fix-budget-rule verifier world-refuses check. Never merged.

## Verifier brief

None: this item is never built.
