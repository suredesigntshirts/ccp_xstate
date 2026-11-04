# Waiting wake: every asking state sets a one-hour checkBack timer that moves nothing (2026-11-04)

Item: fix-waiting-wake. Two-way doors, decided by the building thread as the person's stand-in.

## The questions

1. C-waiting-does-not-stall wants a wake scheduled for an item waiting on a person's card. quick-fix's asking states
   set no timer, and neither do feature's and research's. What timer, in which states, and what happens when it fires?
2. How does the command-line host (bin/host.js), which has no clock, get the wake scheduled?
3. How is a new asking state kept from leaving the timer out?

## Decisions

1. **A `checkBack` timer of one hour on every state that invokes `ask`, with no target and no actions.** These are
   quick-fix's awaitingGates, awaitingMerge and replanning, feature's replanning, and research's awaitingPublish and
   replanning. The engine already turns a delayed transition into a timer effect and a cancel effect (host.js), and
   any wake past the due time fires it (wake.js). One engine change: the host takes a set timer's event even when its
   transition changes nothing, which XState's `can()` reports as not taken (host.js refusal). When it fires, nothing moves:
   the item stays in its state, its ask run stays open and its card stays up. The wake's work is the thread's: it is
   back with the item, sees what has changed (a missed GitHub event, a grant a stand-in can answer under, other
   items to advance) and does what doesn't need the answer (L-never-idle-on-person). One hour, because a lost
   GitHub event or a quiet thread then costs at most an hour, and one host call an hour is cheap.
2. **bin/host.js passes the timer and cancel handlers with no clock.** A timer effect then ends at once with its due
   time as its outcome, a cancel ends at once, and neither stays pending for ever (today a cancel for a timer it left
   would). The open timer and its due time are still listed under `pending.timers`, which is what the session reads
   to schedule its wake (send_later at the due time). The README already says a timer's due time is there for the
   session to schedule.
3. **The load check refuses a state that invokes `ask` and has no `after` transition**, naming the workflow and the
   state. The lesson is about every waiting state, not three of them; the check keeps it that way for the next
   workflow.

## Why not

- **A repeating timer.** In XState a delayed transition is scheduled on entry, so repeating it needs re-entering the
  state, which stops the ask run and puts up a new card (and, since fix-finish-closes-waits, closes the old one), or a
  nested child state, which changes every asking state's value from a string to an object across the engine, the
  observe page and every test that reads it. One wake per entry is enough for the case; a thread that wakes and finds
  nothing changed can schedule its own next check.
- **Moving the item when the timer fires** (to replanning, or dropping it). The person's silence is not an answer.
  A stand-in answers only under a grant the person set (C-stand-in-picks-legal-event).
- **A reminder post to the person.** The person is told once, by the card; posting again every hour is noise.
- **A command to record that the session scheduled the wake** (like `card`). The timer fires from the wake's time
  whether or not anything was recorded, so a record would add a step that proves nothing.

## What would change it

A thread that sleeps through a whole night after one check. Then the timer repeats, and the cost of a nested state
is paid.
