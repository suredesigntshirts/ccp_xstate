```json
{
  "id": "item-head-trim",
  "title": "Let an item's head hold only what changes from item to item",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A ready item needs no `verifier` field and no `step_back`: the verifier is always a separate session working from the item's Verifier brief, and an item without `step_back` gets two rounds, the limit the rework view already assumes; `step_back` holds only `max_rounds` when an item needs another limit; plan/README.md's field table and the Verifier brief rule say so, the brief adding only what the Expect lines' `how` fields leave out; done items keep the fields they have and still pass the plan check.",
  "why": "Every ready item restates two things that never vary: 36 heads carry the same verifier sentence and step_back's max_tokens and replan_to are read by nothing, while each Verifier brief repeats the Expect lines' `how` line by line, so authors write and readers read the contract three times (L-rules-live-in-the-repo, L-count-concepts; decisions plan/decisions/2026-11-08-refine-round-2.md).",
  "serves": [
    "L-count-concepts",
    "L-rules-live-in-the-repo",
    "L-expect-format-one-owner"
  ],
  "depends_on": [
    "rules-said-once",
    "plan-reader-effort"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-2.md",
      "what": "Read first: what leaves the head and why, and what done items keep"
    },
    {
      "ref": "plan/item.schema.json, plan/check.mjs, test/plan-check.test.mjs",
      "what": "readyRequired, the step_back and verifier properties, the ready checks and their tests"
    },
    {
      "ref": "plan/README.md",
      "what": "How an item is written: the field table and the Verifier brief sentence"
    },
    {
      "ref": "packages/journal/src/derive/rework.js",
      "what": "DEFAULT_LIMIT, the round limit the rework view uses when a head sets none"
    }
  ],
  "outputs": [
    {
      "ref": "plan/item.schema.json",
      "what": "readyRequired drops verifier and step_back; step_back's properties are max_rounds alone, with max_tokens and replan_to described as kept for done items; verifier described as kept for done items"
    },
    {
      "ref": "plan/check.mjs",
      "what": "No change beyond what the schema drives, unless a ready check named the two fields"
    },
    {
      "ref": "test/plan-check.test.mjs",
      "what": "Builder tests: a ready item with neither field passes; a ready item missing expect is still refused"
    },
    {
      "ref": "plan/README.md",
      "what": "The field table drops the verifier row and says step_back defaults to two rounds; the Verifier brief adds only what the `how` fields leave out (setup, traps, what not to read)"
    }
  ],
  "expect": [
    {
      "id": "lean-ready-passes",
      "check": "On a temp copy of the head's plan/, check.mjs passes a ready build item whose head has no verifier and no step_back field and otherwise meets every ready rule, and still refuses (exit 1, naming the field) the same item with expect, outputs or why emptied",
      "how": "The verifier's own tests copying plan/ to a temp folder and editing one item head",
      "proof": "verifier"
    },
    {
      "id": "done-heads-pass",
      "check": "check.mjs passes on the head's real plan, where done items still carry verifier, step_back.max_tokens and step_back.replan_to; on the temp copy, a ready item whose step_back has max_rounds 3 passes and one whose max_rounds is 0 is refused",
      "how": "The verifier's own tests on the real plan and the temp copy",
      "proof": "verifier"
    },
    {
      "id": "rule-written",
      "check": "A fresh headless Claude session given a clone of the head and asked only \"Using only this repository, which fields must a ready item's head fill, how many rounds does an item get when its head names none, and what goes in its Verifier brief?\" answers without naming verifier or step_back as required, says two rounds, and says the brief holds what the Expect lines' how fields leave out",
      "how": "The verifier runs claude -p in a clean clone and grades the answer",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "test/plan-check.test.mjs goes red when verifier is put back in readyRequired, and green again when restored",
      "how": "The verifier breaks it and runs the test file",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "npm test passes at the head; the PR changes only the files the outputs name and its own plan item, and no other item file",
      "how": "The verifier runs the suite and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [
      "the Verifier brief's per-line steps into the Expect lines' how fields"
    ],
    "removes": [
      "the verifier field from new heads",
      "step_back's max_tokens and replan_to from new heads, and step_back itself where two rounds suffice"
    ],
    "budget": 0
  },
  "non_goals": [
    "No done, doing or ready item's file changes: frozen heads keep their fields, and the schema still accepts them",
    "No engine, plugin or workflow change, so no release",
    "The two-round default is not new: the rework view's DEFAULT_LIMIT already uses it"
  ],
  "records": [
    "The plan check's output on the PR's ci run"
  ],
  "step_back": {
    "max_rounds": 2
  },
  "verifier": "A separate session, using the Verifier brief below."
}
```

## What this is

Round 2 of the refine rounds (round 1 was `rules-said-once`). An item head is what every author writes and every
builder and verifier reads first. Two fields say the same thing in every item, so they move out of the head into the
one rule that already states them (`plan/README.md`, "How slop is kept out" and "How an item moves"). The decisions
are in `plan/decisions/2026-11-08-refine-round-2.md`.

This item is filed under the rules it changes, so its head still carries both fields; items readied after it
leave them out. It waits for `plan-reader-effort`, which edits `plan/check.mjs` and `plan/item.schema.json` too.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/item-head-trim/` without reading
the builder's. For the temp-copy checks, copy `plan/` whole (check.mjs reads stages, ledger and cases beside items)
and run `node <copy>/check.mjs`. For `rule-written`, unset `CLAUDE_CODE_REMOTE_SESSION_ID` before `claude -p`, and
commit the prompt and answer as the evidence file.

## Done

Built in #230 and verified 6/6 by a separate session (`verify/item-head-trim/verdict.json`). Items readied from now on
may leave out `verifier` and `step_back`.
