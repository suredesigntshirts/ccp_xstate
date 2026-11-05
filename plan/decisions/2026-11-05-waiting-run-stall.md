# Stall guard: the owner's waiting runs, two blocks, a cannot-start exit, a stalls view (2026-11-05)

Item: fix-waiting-run-stall. Two-way doors, decided by the building thread as the person's stand-in, when the item
went ready. The person asked on 5 Nov for a guard that keeps its own count of blocks per run, has a fail exit, and
measures how often stalls happen.

## The questions

1. Which waiting runs does a Stop check, so a thread is not blocked over another item's run?
2. How many blocks per run, how are they counted, and what happens past the cap?
3. What is the thread's fail exit when it cannot make the Agent call?
4. What happens in a Projects thread, whose turn ends through a hearthbot tool?
5. How is "how often" measured, and how does a real run prove a block led to a spawn?

## Decisions

1. **The runs of items this session owns.** Every run.json carries `session`, the item's owner (prepare() takes
   host.session, and deliver() restores as the owner). The Stop hook checks the runs prepared, not started and not
   failed whose session is the hook input's session_id or its sessionName (the cloud URL form), because `start
   --session` may have been given either. A run of an item another session owns never blocks this one. The
   UserPromptSubmit and PostToolUse lines that list waiting runs stay as they are (not this item).
2. **Two blocks per run, counted in the journal, then the run fails.** Claude Code's stop_hook_active only says this
   stop follows a block; it does not count across turns, so it is not used. Each block is a `refusal` row with rule
   `stall`, outcome `blocked`, and `count` and `cap` in its payload; the count is the number of such rows for the run
   in the item's file, as fix-refusal-hints counts refusals (no second counter file). Two, because the first block
   catches a thread that simply forgot, and a second catches one that was mid-way through something else; a thread
   that ends a third time with the run still waiting will not start it. The third stop is let through, and the run
   fails: failed.json's why starts `stalled:`, a `stall-cap` row is journalled, and the run is delivered, so the item
   takes the invoke's onError. In every workflow today that is a state with a card in front of the person (quick-fix:
   replanning), so "put up a card" is the workflow's own error path, not a card the hook invents. A hook cannot
   reach the thread's card tools anyway.
3. **An Agent call with the prompt `ccp-cannot-start <run>: <why>`.** The PreToolUse hook of the Agent tool already
   reads every Agent prompt for `ccp-run`; it now also reads this one, denies the call (no agent starts), fails the
   run with why `cannot-start: <why>`, journals a `cannot-start` row, and delivers the run, so the item steps back
   with the thread's own reason. Only the owning session may use it (others are refused `wrong-session`). A Bash
   command was weighed and dropped: the thread may have no repo checkout, and the plugin's path is not known to the
   model. Where the Agent tool itself is missing, the exit is not there either, and the cap covers that case. A
   failed run is no longer listed as waiting, and `ccp-run` of it is refused `already-failed`.
4. **The same as any session.** The Stop hook fires when the model's turn ends, whatever its last tool call was; a
   block makes the model continue with the reason as its next instruction. The reason says to make the Agent call
   and then end the turn as usual, so a Projects thread ends with its hearthbot call after the spawn. This is proven
   with headless `claude -p` and the plugin loaded; the first real Projects thread stall shows in the stalls view.
5. **A derived view, `derive.js stalls`.** It reads the journal: runs prepared (brief.stored rows), runs blocked at
   least once, blocks, runs whose agent started after a block (an agent.spawn row for the run later than its first
   stall row), runs failed at the cap, and cannot-start runs, with the stall rate as runs blocked over runs
   prepared. The real-run Expect line reads the same rows to prove a block led to a spawn.

The block reason names the item, its state, the run, its actor, the exact Agent prompt, which block of the cap this
is, and the cannot-start exit. No stage prompt changes. The guard is one new concept (budget 1).
