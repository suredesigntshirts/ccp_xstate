# Refusal hints: the field's own Output line, a key diff, and a cap of 8 (2026-11-05)

Item: fix-refusal-hints. Two-way doors, decided by the building thread as the person's stand-in, when the item went
ready.

## The questions

1. Is the hint the field's description verbatim, or a pointer to the Output line the agent already has?
2. What does a restated refusal say?
3. What is the cap on refusals per run, which refusals count, and what happens at it?

## Decisions

1. **Verbatim, in a separate `hint`, not folded into `reason`.** The description is the fix in the prompt's own
   words, and by the time an agent returns its prompt is far behind it; a pointer makes it go and find the line,
   which is exactly the re-reading this item is meant to remove. The hint names only the top-level fields the reason
   names (`result.pr.at` names `pr`), once each, so a two-field refusal gives two lines and no more. Top-level fields
   are the only ones with descriptions (prompts.js), so a nested fault gets its top-level field's line. `reason`
   stays as it is: it is what went wrong, and several done items' tests compare it exactly; `hint` is how to fix it.
   The hook prints both, then the count.
2. **Every differing key path, with both values.** `result.issue.expect[1] is "...", the input's is "..."`; a key the
   input lacks is named as not in the input; arrays of different length are named whole. All of them at once,
   because the checks stop at the first rule that fails and one refusal per key would spend the cap on one field.
   Values are JSON cut to 200 characters, enough to see a changed word in an expect line.
3. **8, counting only refusals of the result** (schema, reserved, restated, covers, ref). The checks run in order and
   stop at the first that fails, so a result wrong under every rule needs at most five rounds to clear them; 8 leaves
   three spare, and the only real-run refusal so far was cleared on the second try. Refusals that are not about the
   result (wrong-caller, unknown-run, already-returned, already-failed) do not count, so another agent cannot use up
   a run. The refusal that reaches 8 fails the run the way a stop without a return does (failed.json, then the
   invoke's error event), with every refusal's rule and reason as the why, so the item steps back with the evidence
   instead of the agent looping until it gives up. Each refusal says `Refusal <n> of 8.`, so the agent knows its
   budget. The count is read from the item's journal (the refusal rows for the run), not kept in a second file.

No prompt changes: returnLine already says "If the tool refuses, fix what it names and call it again", and changing
any prompt text would move every run's brief hash and need a bench report. The cap is a new concept (budget 1).
