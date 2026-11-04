# Finish closes waits: the stop effect closes the card, and a PR closed elsewhere ends the item (2026-11-04)

Item: fix-finish-closes-waits. Two-way doors, decided by the building thread.

## The questions

1. Leaving a state that asked emits a `stop` effect (host.js effectsOf), and no handler carries it out, so the card
   stays up. What carries it out, and how does a host that can't reach the thread (bin/host.js) close a card?
2. When quick-fix's PR is merged on GitHub by another path, the item goes to `replanning` and puts up a new
   "replan or drop" card beside the merge card it left. Should it?

## Decisions

1. **A `stop` handler, by the stopped run's actor.** The stop effect names its run's actor. For an `ask` run the
   handler asks the thread to close the card keyed by the run's effect id (`hearth.close({ key })`, the same key the
   card was made with); a card never made has nothing to close. For every other actor (agents, post, merge, child
   items) the stop finishes at once: there is nothing in front of the person, and a late result is already turned
   away as stale (C-stale-completion-dropped).
2. **The command-line host closes a card the way it opens one.** A host process has no thread tools, so for a card
   that was recorded as up, the stop waits: `bin/host.js show` lists it under pending with the card's run, the
   session that has the tools withdraws it (`close_decision` with no choice) and records that with
   `bin/host.js closed --effect <ask run id>`, and the next call finishes the stop. This mirrors `card` (relay.js).
   A card recorded after its run was stopped is refused, and the refusal says to withdraw the card that was put up.
3. **A PR closed by another path ends the item, with no new card.** In every state that holds the PR (checking,
   verifying, reverifying, awaitingGates, awaitingMerge), `github.pull_request.closed` for the item's PR, merged or
   not, moves the item to a new final state `closedOutside`, with `failure.closedOutside` and `failure.outcome` set.
   It is never `done`: `done` still needs the host's own merge. The person is not asked anything: the ledger lesson
   (L-item-finish-clears-inbox, ccp_machine#157) is that an item finished out of band must leave nothing in the
   inbox, and a merge outside the host is already reported by the health check (`journal-check --host`, case
   C-merge-outside-host-detected), which is where an unverified merge belongs. A PR closed without a merge is the
   person (or someone) cancelling the work on GitHub; asking them again is the same noise.
4. **The item view counts a stopped ask as closed.** The observe page's item view (plugins/harness, data.js) marks an
   ask closed, not open, once its stop effect is done, and ends its wait there, so nothing about it shows as waiting.

## Why not

- Keep `replanning` after a merge elsewhere (lane A's Q7 shape): it keeps a card in front of the person about work
  already merged, which is the exact failure the case comes from. Q7's scenario is changed with this item: it now
  expects `closedOutside`, no card, the old card closed, and no merge effect.
- Close cards from the host process itself: it has no way into the thread; inventing one is a one-way door
  (platform access) for no gain over the record the `card` step already uses.
- Cancel a child item when its parent's state is left: the stop for a child item finishes at once here, and the child
  keeps its own cards. Cancelling children is its own question, for a case that needs it.

## What would change it

A person who wants to be told when an item ends outside the host. Then a `post` (not a decision) goes in the
`closedOutside` state, which asks nothing and waits on no one.
