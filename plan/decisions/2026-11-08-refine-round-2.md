# Refine round 2: an item's head holds only what varies (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 2 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick and the concepts used).

## 1. What leaves a new head

- **`verifier`.** Since `verification-contract` the verifier is always a separate session working from the item's
  Verifier brief, and the verdict gate refuses a verdict from the builder's session. 36 ready or done heads carry the
  same sentence, 30 more carry variants written before that rule. A field that never varies is not a contract term;
  the rule lives in `plan/README.md`. (Ousterhout: make the common case simple; Pragmatic Programmer: DRY.)
- **`step_back` when it is two rounds.** Nothing reads `max_tokens` or `replan_to`; the rework view reads
  `max_rounds` and assumes 2 when it is absent (`DEFAULT_LIMIT` in `packages/journal/src/derive/rework.js`). An item
  names `step_back.max_rounds` only to change that. (Define the special case out: the default is the rule.)
- **The Verifier brief's per-line restatement.** Each Expect line already has `how`. The brief adds only what the
  `how` fields leave out: setup, traps, what not to read. One home for how a line is checked.

## 2. What stays

Done, doing and ready items are frozen and keep their fields; the schema still accepts `verifier`,
`step_back.max_tokens` and `step_back.replan_to` so they pass, described as kept for done items. This is the one
compatibility the plan needs: rewriting frozen heads is refused by the freeze gate, and the history is theory.

## 3. Order

`item-head-trim` waits for `plan-reader-effort`, which edits the same two files; the change here is a few lines of
`plan/item.schema.json` and the README table.

## Not adopted

- Dropping `inputs` (overlaps the prose) or `records`: both vary per item and readers use them.
- A minimum item template file: the README table is the template, and a second copy would drift.
