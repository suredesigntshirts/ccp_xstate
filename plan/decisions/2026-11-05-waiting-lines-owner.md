# Waiting-run lines: the owner's runs only, and spawn refuses another session's run (2026-11-05)

Item: fix-waiting-lines-owner. Two-way doors, decided by the building thread as the person's stand-in, when the item
went ready.

## The questions

1. Which runs do the UserPromptSubmit and PostToolUse-of-Agent lines name?
2. Is filtering the lines enough, or should spawn() also refuse a `ccp-run` from a session that doesn't own the run's
   item?
3. What about the other places that list waiting runs (`bin/host.js` output, deliver()'s `waiting`)?

## Decisions

1. **The same runs the Stop guard checks.** The lines list the runs prepared, not started and not failed whose
   run.session is the hook input's session_id or its sessionName (the cloud URL form), across all items, because
   `start --session` may have been given either. That is the set stall() already uses, so the engine exports it once
   (`ownedWaiting(root, sessions)`, today private to actors.js) and the hook calls it instead of its own
   `waitingRuns`, which lists every item's runs. The line text is unchanged; a session with none of its own runs
   waiting gets no line.
2. **spawn() refuses too, when the hook says who is asking.** A filtered line stops the model being told to start
   another session's run, but a model can still copy a run id from elsewhere (another thread's `bin/host.js` output,
   a shared file, the journal). The item's outcome is that no session starts a run whose item another session owns,
   so the PreToolUse hook passes the same owner names to spawn() as `sessions`, and a run whose session is not one of
   them is denied `wrong-session: run <run>'s item is owned by <owner>; only that session may start it`. No
   spawn.json is written, so the owner can still start it. The rule name is the one cannotStart() already uses, so
   no new concept. Callers that pass no `sessions` (the engine's own tests, verifier drivers that call spawn()
   directly) keep today's behaviour: the check runs only when `sessions` is given. A run.json with no session is not
   checked (bin/host.js refuses to start an item without one, so none exists today).
3. **Unchanged.** `bin/host.js` prints the waiting runs of the one item it was run for, to the session that ran it,
   and deliver() restores the item as its owner. Neither lists another item's runs.

The order in the PreToolUse hook stays cannotStart, then spawn. The refusal text starts with its rule, as every hook
refusal does, so capture's refusal rows and derive's views pick it up as they do the other spawn denials.
