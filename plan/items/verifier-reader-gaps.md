```json
{
  "id": "verifier-reader-gaps",
  "title": "Close the gaps a fresh verifier found in the verdict rules",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A verifier reading only docs/gates.md knows how to run the verdict gate on its own checkout (BASE_SHA and PR_BODY with the Item line, HEAD defaulting to the checkout's HEAD), that a world result needs no test and a line about the PR's checks cites them at verified_sha, and that model is its own model id; plan/README.md step 2 says done_on is set only for an item naming a module; the fresh-reader-gaps suite reads step 2 for what it says rather than its exact sentence; and the three entry texts stay under the 225-line budget.",
  "why": "A fresh headless session asked to verify a build PR (8 Nov, at main cb2456a8) named what it had to guess or dig out of scripts/gates/: which environment the local gate run needs, whether a world line names a test, which sha a ci line cites when its own verdict commit makes a new head, and what model means. The fresh-reader-gaps verifier noted step 2 says done_on is always set, though only an item naming a module needs it (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-7.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "fresh-reader-gaps"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-7.md",
      "what": "Read first: what the fresh verifier asked, and each answer"
    },
    {
      "ref": "docs/gates.md, plan/README.md",
      "what": "The local gate run, The verdict, How an item moves step 2"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs, scripts/gates/lib.mjs",
      "what": "Which environment the gate reads, and what checkVerdict asks of each proof"
    }
  ],
  "outputs": [
    {
      "ref": "docs/gates.md",
      "what": "The local run names BASE_SHA and PR_BODY with the Item line at the checkout's HEAD; the verdict example's model reads as the verifier's own model id; the gate's list says a world result needs no test and a line about the PR's checks cites them at verified_sha, folds the builder fields into the test bullet and observations beside them"
    },
    {
      "ref": "plan/README.md",
      "what": "Step 2 says done_on is set to the first commit's day when the item names a module, in three lines; the folder listing drops its line for README.md itself"
    },
    {
      "ref": "verify/fresh-reader-gaps/fresh-reader-path.test.mjs",
      "what": "Its two step-2 checks match what step 2 says (done and done_on set by the first commit; nothing written under verify/<id>/; a verifier asked for) rather than the exact sentence"
    }
  ],
  "expect": [
    {
      "id": "local-gate-run",
      "check": "In a temp repo with a build branch holding a complete verdict from another session, running the command docs/gates.md gives for a local verdict run, with <id> filled in, passes; with PR_BODY unset it refuses for naming no item",
      "how": "The verifier's own test in a temp repo built from the head",
      "proof": "verifier"
    },
    {
      "id": "world-needs-no-test",
      "check": "The verdict gate passes a complete verdict whose world result has no test field, and docs/gates.md states that a world result needs no test and that a line about the PR's checks cites them at verified_sha",
      "how": "The verifier's own test: the gate on a temp repo, and a read of docs/gates.md The verdict",
      "proof": "verifier"
    },
    {
      "id": "done-on-when-module",
      "check": "plan/README.md step 2 says done_on is set when the item names a module, and node plan/check.mjs passes a done item with no module and no done_on and refuses a done item naming a module without done_on",
      "how": "The verifier's own test reading step 2 and running the plan check on a temp plan copy",
      "proof": "verifier"
    },
    {
      "id": "fresh-verifier",
      "check": "A fresh headless Claude session given a clean clone of the head and the question in the Verifier brief answers, citing docs/gates.md, the local verdict-gate command with PR_BODY carrying the Item line, that a world result needs no test, which sha a line about the PR's checks cites, and that model is its own model id",
      "how": "The verifier runs claude -p in a clean clone with the brief's question and grades the answer against these four points",
      "proof": "world"
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
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No gate logic changes and no released file, so no release",
    "How a verifier finds its own session URL stays with the platform; docs/gates.md, Sessions, says what the trailer holds"
  ],
  "records": [
    "The fresh session's answer, as the fresh-verifier evidence file"
  ]
}
```

## What this is

Round 7 of the refine rounds. Round 6 asked a fresh reader to build an item; this round asked one to verify a build PR,
and writes each answer it had to dig for into `docs/gates.md`, where it looked. It also takes the `done_on` note the
round 6 verifier left. The decisions are in `plan/decisions/2026-11-08-refine-round-7.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/verifier-reader-gaps/`.
`verify/rules-said-once/lib.mjs` has a temp-repo helper for the gates. For `fresh-verifier`, run
`env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only this repository, you are a new
session asked to verify a build PR. How do you run the verdict gate locally before committing, does a world result
in verdict.json name a test, which sha does your evidence for the PR's ci checks cite, and what goes in the verdict's
model field? Cite the files." Commit the prompt and the answer as the evidence file.
