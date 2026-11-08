```json
{
  "id": "done-with-the-build",
  "title": "Mark an item done in its build PR, so no PR follows the merge",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "An item becomes done in its own build PR: the PR's first commit sets status done (and done_on for an item naming a module), the verdict gate proves it before the merge, and no PR follows the merge. plan/README.md's How an item moves has four steps, with no done replan, and names the statuses draft, ready and done; a gate test keeps a build PR that sets done passing the freeze gate; the entry texts' line budget in test/docs.test.mjs drops to 226; docs/traps.md says CI checks out at depth 1.",
  "why": "Every item costs three PRs: the readying replan, the build and a done replan whose only content is a status flip and a ## Done paragraph saying what git and verify/<id>/ already say. The done status repeats the verdict, a thread that forgets the done replan leaves main saying an item is open, and each done replan is one more CI wait and merge (L-proof-source, L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-4.md).",
  "serves": [
    "L-proof-source",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "map-once-traps-written"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-4.md",
      "what": "Read first: why done moves into the build PR and what is left for later rounds"
    },
    {
      "ref": "plan/README.md, CLAUDE.md, docs/language.md",
      "what": "The steps from ready to done and the words for a contract change"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "The frozen part of an item (its head without status and done_on) and the gate's tests"
    }
  ],
  "outputs": [
    {
      "ref": "plan/README.md",
      "what": "How an item moves: four steps (readying replan, build PR whose first commit sets status done, verdict, merge and release); statuses draft, ready, done, off the path split, dropped, parked; no done replan"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Working an item names four steps"
    },
    {
      "ref": "docs/language.md",
      "what": "contract change reads as the one replan an item's contract may have once its build PR names it, before its verdict file exists"
    },
    {
      "ref": "scripts/gates/test/pr-gate.test.mjs",
      "what": "A test: a build PR naming its item, whose commit sets the item's status to done and done_on and changes a file outside plan/, passes the freeze gate"
    },
    {
      "ref": "test/docs.test.mjs",
      "what": "BUDGET is 226"
    },
    {
      "ref": "docs/traps.md",
      "what": "The shallow-clone trap says ci.yml checks out at depth 1, as it does, instead of full history"
    }
  ],
  "expect": [
    {
      "id": "build-sets-done",
      "check": "In a temp repo built from the head, an item at ready, a build branch whose first commit sets that item's status to done with a done_on date and adds a file outside plan/, and a body naming the item: the freeze gate passes; the verdict gate refuses it only for the missing verdict; after a separate session commits a complete verdict for it, the verdict gate passes; and node plan/check.mjs passes on that tree",
      "how": "The verifier's own test driving scripts/gates/pr-gate.mjs and plan/check.mjs in a temp repo",
      "proof": "verifier"
    },
    {
      "id": "own-build-done",
      "check": "GitHub shows this item's build PR with ci and verdict green at its head, and the item file at that head says status done, set in the PR's first commit",
      "how": "The verifier reads the PR's checks and its first commit",
      "proof": "world"
    },
    {
      "id": "fresh-reader-done",
      "check": "A fresh headless Claude session given a clone of the head and asked how a ready item becomes done answers that the build PR's first commit sets status done, that it merges once ci and verdict are green, and that no PR follows the merge",
      "how": "The verifier runs claude -p in a clean clone with the question in the Verifier brief and grades the answer",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "The new pr-gate test goes red when the frozen part of an item in scripts/gates/lib.mjs is made to include status, and green again when restored",
      "how": "The verifier breaks it and runs the test file",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head, and the PR changes only the files the outputs name and its own plan item",
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
    "merges": [
      "the done replan into the build PR's first commit"
    ],
    "removes": [
      "the done replan and its ## Done section",
      "doing as a step of the path"
    ],
    "budget": 0
  },
  "non_goals": [
    "No gate or check logic changes, so no release: the freeze gate already leaves status and done_on out of the contract",
    "doing stays a valid status in item.schema.json for builds already open; taking it out is a later round, once no branch uses it",
    "Done items keep their ## Done sections; none is rewritten"
  ],
  "records": [
    "The new pr-gate test's output on the PR's ci run"
  ],
  "step_back": {
    "max_rounds": 2
  },
  "verifier": "A separate session, using the Verifier brief below."
}
```

## What this is

Round 4 of the refine rounds. Rounds 1 to 3 gave each rule one home and shortened what a thread reads first; this
round takes a step out of the process itself. Main never shows `doing`, because the build PR's first commit is the
only place it is set, so main sees an item go from `ready` straight to `done` already. Setting `done` in that commit
instead removes the PR that follows every merge. The verdict gate is what makes the status true: a build PR whose item
says `done` cannot merge without a complete verdict from another session. This item is the first built that way. The
decisions are in `plan/decisions/2026-11-08-refine-round-4.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/done-with-the-build/` without
reading the builder's. For `build-sets-done`, `verify/rules-said-once/lib.mjs` has a temp-repo helper you may copy.
For `fresh-reader-done`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only this
repository, answer: plan item X is ready. What PRs does it take to become done, what does each change, and is any PR
needed after the build PR merges?" Commit the prompt and the answer as the evidence file.
