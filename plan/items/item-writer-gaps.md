```json
{
  "id": "item-writer-gaps",
  "title": "Close the gaps a fresh reader found in writing a ready item",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A thread writing a new item learns from plan/README.md that the plan check names any field of the schema's readyRequired a ready item leaves open, and that depends_on never points at a later stage; the field table no longer lists reader_effort, which no item writes; CLAUDE.md names the four steps as leading to done rather than starting at ready; and the plan check's sha rule refuses a run of seven or more hex digits only when it holds a digit, so a word such as defaced passes; the three entry texts stay under the 225-line budget.",
  "why": "A fresh headless session asked to turn a one-line idea into a ready item (8 Nov, at main 1c0c9cdd) found which fields a ready item needs only by reading check.mjs, found the later-stage rule only in code, read the reader_effort row as a field to fill, read CLAUDE.md's four steps as starting at ready, and found that the sha rule refuses ordinary words made of the letters a to f (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-9.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "verifier-reader-gaps"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-9.md",
      "what": "Read first: what the fresh reader asked, and each answer"
    },
    {
      "ref": "plan/README.md, CLAUDE.md, plan/check.mjs, plan/item.schema.json",
      "what": "How an item is written, Changing the plan, Working an item, the SHA rule and readyRequired"
    }
  ],
  "outputs": [
    {
      "ref": "plan/README.md",
      "what": "How an item is written says the plan check names a readyRequired field a ready item leaves open; the reader_effort row leaves the field table; To add an item says depends_on never points at a later stage"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Working an item: the four steps to done"
    },
    {
      "ref": "plan/check.mjs",
      "what": "SHA matches seven or more hex characters only when at least one is a digit"
    },
    {
      "ref": "test/plan-check.test.mjs",
      "what": "A ready check holding words of hex letters alone (defaced, effaced, deadbeef) passes; the sha cases still refuse"
    }
  ],
  "expect": [
    {
      "id": "hex-words-pass",
      "check": "On a temp copy of the head's plan/, a ready item whose Expect check holds two words of seven or more letters, all between a and f, passes node plan/check.mjs, and the same item holding a 7-digit or a 40-digit sha with a digit in it is refused naming the sha",
      "how": "The verifier's own test on a temp plan copy",
      "proof": "verifier"
    },
    {
      "id": "ready-fields-named",
      "check": "On a temp copy of the head's plan/, a ready item missing a field the schema's readyRequired names is refused naming that field, and plan/README.md's How an item is written says so, naming readyRequired; plan/README.md's Changing the plan says depends_on never points at a later stage, and the plan check refuses an item that depends on one in a later stage",
      "how": "The verifier's own tests running the plan check and reading the README for the words that carry each rule",
      "proof": "verifier"
    },
    {
      "id": "fresh-writer",
      "check": "A fresh headless Claude session given a clean clone of the head and the question in the Verifier brief answers, citing repository files, which head fields a ready item must fill and where that list lives, that depends_on may not point at a later stage, and that reader_effort is not a field it writes",
      "how": "The verifier runs claude -p in a clean clone with the brief's question and grades the answer against these three points",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "The new plan-check case goes red when SHA in plan/check.mjs is put back to match hex letters alone, and green when restored",
      "how": "The verifier breaks SHA and runs test/plan-check.test.mjs",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head, test/docs.test.mjs among them, and the PR changes only the files the outputs name and its own plan item",
      "how": "The verifier runs both and reads the diff's file list",
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
    "merges": [],
    "removes": [
      "the reader_effort row of the field table"
    ],
    "budget": 0
  },
  "non_goals": [
    "The PINS words stay in plan/check.mjs, which the README already names; copying them into the README would be a second list",
    "No gate logic or released file changes, so no release"
  ],
  "records": [
    "The fresh session's answer, as the fresh-writer evidence file"
  ]
}
```

## What this is

Round 9 of the refine rounds. Rounds 6 and 7 tested the build and verify paths on a fresh reader; this round tests
writing an item, the step before them, and fixes a rule that refused ordinary words. The decisions are in
`plan/decisions/2026-11-08-refine-round-9.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/item-writer-gaps/`, reading rule
texts by the words that carry each rule (`docs/layout.md`, Tests). `verify/verification-contract/lib.mjs` has a
temp-plan helper. For `fresh-writer`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with:
"Using only this repository, you are turning an idea into a ready plan item. Which head fields must a ready item fill,
and where is that list kept? May depends_on name an item in a later stage? Do you write reader_effort? Cite the files."
Commit the prompt and the answer as the evidence file.
