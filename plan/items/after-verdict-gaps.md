```json
{
  "id": "after-verdict-gaps",
  "title": "Close the gaps a fresh builder found after the verdict",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A builder whose PR has a verdict learns from plan/README.md that a NOT MET line sends it back to push a fix and ask its starter for a verifier again, the next verdict.json replacing the last, and that it merges with a merge commit, may merge main in without losing the verdict, and tells its starter what the release command printed; docs/language.md defines starter and round; docs/gates.md's verdict row points at the checks below instead of saying at the head sha; plugins/harness/README.md and the release script's skip reason name RELEASED instead of a partial copy; docs/traps.md says a red test the PR did not touch gets one re-run; the three entry texts stay under the 225-line budget.",
  "why": "A fresh headless session asked what a builder does once a verdict lands (8 Nov, at main 60a2760f) guessed what a NOT MET verdict sets going, the merge method, whether merging main in keeps the verdict, whom to tell, what starter and round mean, which paths a release watches, and what to do with a red test it did not touch (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-10.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "item-writer-gaps"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-10.md",
      "what": "Read first: each gap the fresh reader named, and its answer"
    },
    {
      "ref": "plan/README.md, docs/gates.md, docs/language.md, docs/traps.md, plugins/harness/README.md, scripts/release/release.mjs",
      "what": "How an item moves steps 3 and 4, the verdict row, Plan and Platform terms, the traps, Releases, RELEASED and plan()"
    }
  ],
  "outputs": [
    {
      "ref": "plan/README.md",
      "what": "Step 3: on a NOT MET line the builder pushes a fix and asks again, and the next verdict replaces the last; step 4: a merge commit, merging main in keeps the verdict, the merging thread tells its starter what the release command printed"
    },
    {
      "ref": "docs/gates.md",
      "what": "The verdict row says no complete verdict for the head (below); the second copy of the Item: line rule leaves"
    },
    {
      "ref": "docs/language.md",
      "what": "A round line in Plan and a starter line in Platform"
    },
    {
      "ref": "docs/traps.md",
      "what": "A red test the PR did not touch: one re-run, then a real failure"
    },
    {
      "ref": "plugins/harness/README.md",
      "what": "Releases names RELEASED in scripts/release/release.mjs instead of listing paths"
    },
    {
      "ref": "scripts/release/release.mjs",
      "what": "The skip reason names RELEASED's paths from RELEASED; the head comment names no item"
    }
  ],
  "expect": [
    {
      "id": "after-verdict-steps",
      "check": "plan/README.md's How an item moves says that on a NOT MET line the builder pushes a fix and asks for a verifier again and the next verdict replaces the last, that the merge is a merge commit, that merging main in keeps the verdict, and that the merging thread tells its starter what the release command printed; docs/gates.md's verdict row no longer says at the head sha",
      "how": "The verifier's own tests reading the texts for the words that carry each rule",
      "proof": "verifier"
    },
    {
      "id": "terms-defined",
      "check": "docs/language.md has a line for round (one build push and the verdict on it) and a line for starter (the session that started a thread)",
      "how": "The verifier's own test reading docs/language.md",
      "proof": "verifier"
    },
    {
      "id": "released-named-once",
      "check": "plugins/harness/README.md's Releases names RELEASED and no longer lists the released paths, and on a temp repo where a release exists and nothing released changed after it, plan() in scripts/release/release.mjs returns a reason naming every path RELEASED includes",
      "how": "The verifier's own test on a temp repo, importing plan and RELEASED",
      "proof": "verifier"
    },
    {
      "id": "flake-trap",
      "check": "docs/traps.md says a ci test the PR did not touch that goes red gets one re-run, and that red again it is a real failure",
      "how": "The verifier's own test reading docs/traps.md",
      "proof": "verifier"
    },
    {
      "id": "fresh-merger",
      "check": "A fresh headless Claude session given a clean clone of the head and the question in the Verifier brief answers, citing repository files, that a NOT MET line means a fix and a new verdict replacing the last, that the merge is a merge commit and merging main in keeps the verdict, and who its starter is",
      "how": "The verifier runs claude -p in a clean clone with the brief's question and grades the answer against these points",
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
    "adds": [
      "round",
      "starter"
    ],
    "merges": [],
    "removes": [
      "the second copy of the Item: line rule in docs/gates.md"
    ],
    "budget": 2
  },
  "non_goals": [
    "No gate logic changes; the gate already treats a merge of main after the verdict as keeping it",
    "No contract change after a NOT MET verdict; the README and the freeze gate already refuse it"
  ],
  "records": [
    "The fresh session's answer, as the fresh-merger evidence file"
  ]
}
```

## What this is

Round 10 of the refine rounds. Rounds 6, 7 and 9 tested building, verifying and writing an item on a fresh reader;
this round tests what the builder does once the verdict lands. The decisions are in
`plan/decisions/2026-11-08-refine-round-10.md`. The README change under `plugins/harness/` makes a release.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/after-verdict-gaps/`, reading
rule texts by the words that carry each rule (`docs/layout.md`, Tests). For `released-named-once`, build the temp repo
with the container's signing off (`docs/traps.md`). For `fresh-merger`, run
`env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only this repository, you built a
plan item's PR and a verifier has committed its verdict. If one line is NOT MET, what happens next? When all are MET,
how do you merge, and may you merge main in first without a new verdict? Who is your starter? Cite the files."
Commit the prompt and the answer as the evidence file.
