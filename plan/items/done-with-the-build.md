```json
{
  "id": "done-with-the-build",
  "title": "Mark an item done in its build PR, so no PR follows the merge",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "An item becomes done in its own build PR: the PR's first commit sets status done (and done_on for an item naming a module), the verdict gate proves it before the merge, and no PR follows the merge. Reader effort is read, never stored: node scripts/reader-effort.mjs --item <id> finds the merge that made the item done and reports that PR, so plan/check.mjs no longer asks a done item for reader_effort. plan/README.md's How an item moves has four steps with no done replan; a gate test keeps a build PR that sets done passing the freeze gate; the entry texts' line budget in test/docs.test.mjs drops to 226.",
  "why": "Every item costs three PRs: the readying replan, the build, and a done replan whose content is a status flip, a ## Done paragraph saying what git and verify/<id>/ already say, and since plan-reader-effort the reader_effort numbers, which git can give at any time. The done status repeats the verdict, a stored derived number repeats git, and each done replan is one more CI wait and merge, or an item left open when a thread forgets it (L-proof-source, L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-4.md).",
  "serves": [
    "L-proof-source",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "map-once-traps-written",
    "item-head-trim",
    "plan-reader-effort"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-4.md",
      "what": "Read first: why done moves into the build PR, why reader effort is read rather than stored, and which suite tests leave"
    },
    {
      "ref": "plan/README.md, CLAUDE.md, docs/gates.md, docs/language.md",
      "what": "The steps from ready to done, the freeze's unfrozen fields, the words for a contract change and reader effort"
    },
    {
      "ref": "plan/check.mjs, plan/item.schema.json, test/plan-check.test.mjs",
      "what": "The reader_effort rule and its tests"
    },
    {
      "ref": "scripts/reader-effort.mjs, scripts/reader-effort.test.mjs",
      "what": "prRange and the command line"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "contract(): the head without status, done_on and reader_effort"
    },
    {
      "ref": "verify/plan-reader-effort/plan-rule.test.mjs, verify/plan-reader-effort/rules-written.test.mjs",
      "what": "Done-suite tests that pin the stored field and the done step"
    }
  ],
  "outputs": [
    {
      "ref": "plan/README.md",
      "what": "How an item moves: four steps (readying replan; build PR whose first commit sets status done and done_on; verdict; merge and release); statuses draft, ready, done, off the path split, dropped, parked; the reader_effort row says it is read with node scripts/reader-effort.mjs --item <id>"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Working an item names four steps"
    },
    {
      "ref": "docs/gates.md",
      "what": "The freeze section still names the fields outside the frozen head, with reader_effort described as kept on done items that have it"
    },
    {
      "ref": "docs/language.md",
      "what": "contract change reads as the one replan an item's contract may have once its build PR names it; reader effort says it is read from git for an item, never stored"
    },
    {
      "ref": "plan/check.mjs",
      "what": "The rule asking a verified done build item for reader_effort leaves; a reader_effort present is still schema-checked"
    },
    {
      "ref": "plan/item.schema.json",
      "what": "reader_effort described as kept on done items that recorded it"
    },
    {
      "ref": "test/plan-check.test.mjs",
      "what": "The test that a verified done build item records reader_effort leaves; a test that one without it passes"
    },
    {
      "ref": "scripts/reader-effort.mjs",
      "what": "--item <id>: the first merge on HEAD's first-parent line whose change sets plan/items/<id>.md's status to done is the item's PR; its report as for that PR, refusing an item no merge made done"
    },
    {
      "ref": "scripts/reader-effort.test.mjs",
      "what": "Builder tests for --item on a temp repo: the merge that set done is found; an item never made done is refused"
    },
    {
      "ref": "scripts/gates/test/pr-gate.test.mjs",
      "what": "A test: a build PR naming its item, whose commit sets status done and done_on and changes a file outside plan/, passes the freeze gate"
    },
    {
      "ref": "test/docs.test.mjs",
      "what": "BUDGET is 226"
    },
    {
      "ref": "verify/plan-reader-effort/plan-rule.test.mjs",
      "what": "The test that a verified done build item without reader_effort is refused leaves; the schema-shape tests stay"
    },
    {
      "ref": "verify/plan-reader-effort/rules-written.test.mjs",
      "what": "The README done-step test leaves (there is no done step)"
    }
  ],
  "expect": [
    {
      "id": "build-sets-done",
      "check": "In a temp repo built from the head, with an item at ready: a build branch whose first commit sets that item's status to done with a done_on date and adds a file outside plan/, with a body naming the item, passes the freeze gate; the verdict gate refuses it only for the missing verdict; after a separate session commits a complete verdict for it, the verdict gate passes; and node plan/check.mjs passes on that tree",
      "how": "The verifier's own test driving scripts/gates/pr-gate.mjs and plan/check.mjs in a temp repo",
      "proof": "verifier"
    },
    {
      "id": "effort-by-item",
      "check": "In a temp repo with two merged PRs, the second of which sets an item's status to done, node scripts/reader-effort.mjs --item <id> --json prints the same numbers as node scripts/reader-effort.mjs <that PR's number> --json, and for an item no merge made done it exits non-zero naming the item",
      "how": "The verifier's own test on a temp repo",
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
      "check": "The new pr-gate test goes red when contract() in scripts/gates/lib.mjs is made to keep status, and the --item test goes red when --item reads the item's last change instead of the merge that set done; each green again when restored",
      "how": "The verifier breaks each and runs the test file",
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
      "doing as a step of the path",
      "reader_effort as a stored field new items must fill"
    ],
    "budget": 0
  },
  "non_goals": [
    "No gate logic changes and no released file, so no release: the freeze gate already leaves status and done_on out of the contract",
    "doing stays a valid status in item.schema.json for builds already open; taking it out is a later round, once no branch uses it",
    "Done items keep their ## Done sections and any reader_effort they recorded; none is rewritten",
    "reader-effort.mjs's counting rules do not change"
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
instead removes the PR that follows every merge. The one thing a done replan added that git could not already show
was `reader_effort`, and it is computed from git: the item's PR is the merge that set it done, so the numbers are read
on demand rather than pasted. The verdict gate is what makes the status true: a build PR whose item
says `done` cannot merge without a complete verdict from another session. This item is the first built that way. The
decisions are in `plan/decisions/2026-11-08-refine-round-4.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/done-with-the-build/` without
reading the builder's. For `build-sets-done`, `verify/rules-said-once/lib.mjs` has a temp-repo helper you may copy; for `effort-by-item`,
`scripts/reader-effort.test.mjs` shows how a temp repo with merge commits is made, but write your own.
For `fresh-reader-done`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only this
repository, answer: plan item X is ready. What PRs does it take to become done, what does each change, and is any PR
needed after the build PR merges?" Commit the prompt and the answer as the evidence file.
