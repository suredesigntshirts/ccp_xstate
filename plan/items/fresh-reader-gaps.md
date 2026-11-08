```json
{
  "id": "fresh-reader-gaps",
  "title": "Close the gaps a fresh reader found on the path from ready to done",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A thread reading only the repository knows, from plan/README.md, CLAUDE.md and docs/gates.md, that the build PR's first commit sets done_on to that day, that the builder writes nothing under verify/<id>/ and asks whoever started it for a verifier, how to run one verifier suite (node --test with the suite's files named, since a bare folder fails), and that the release command after the merge decides from RELEASED in scripts/release/release.mjs what is released; the three entry texts stay within a line budget lowered to 225.",
  "why": "A fresh headless session asked to build a ready item (8 Nov, at main 6bd859a4) walked the path correctly but named five gaps it filled only from memory or by guessing: who starts the verifier, which date done_on takes, whether the builder writes verifier files, why node --test verify/<d>/ fails, and where the release row goes; docs/gates.md and plan/README.md also listed released paths that miss packages/engine/src. Each gap is a question every builder asks again (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-6.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "retire-doing"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-6.md",
      "what": "Read first: what the fresh reader asked, and what each answer is"
    },
    {
      "ref": "plan/README.md, CLAUDE.md, docs/gates.md, test/docs.test.mjs",
      "what": "How an item moves, the commands, After the merge, and the entry texts' line budget"
    },
    {
      "ref": "scripts/release/release.mjs",
      "what": "RELEASED, the paths a release carries"
    }
  ],
  "outputs": [
    {
      "ref": "plan/README.md",
      "what": "Step 2 says done_on is set to the day of the first commit, the PR cannot merge until a verdict proves done, and the builder writes nothing under verify/<id>/ and asks whoever started it for a verifier; step 4 points at the release command instead of listing released paths"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Commands names how to run one verifier suite, with its files named, and says a bare folder fails"
    },
    {
      "ref": "docs/gates.md",
      "what": "After the merge names RELEASED in scripts/release/release.mjs as what decides a release, and drops the journal-row sentence"
    },
    {
      "ref": "test/docs.test.mjs",
      "what": "BUDGET is 225"
    }
  ],
  "expect": [
    {
      "id": "fresh-reader-path",
      "check": "A fresh headless Claude session given a clean clone of the head and the question in the Verifier brief answers, citing repository files, that done_on takes the day of the build PR's first commit, that the builder writes nothing under verify/<id>/ and asks for a verifier rather than writing the verdict, that one verifier suite runs with its test files named, and that the merging thread runs the release command",
      "how": "The verifier runs claude -p in a clean clone with the brief's question and grades the answer against these four points",
      "proof": "world"
    },
    {
      "id": "one-suite-command",
      "check": "The one-suite command CLAUDE.md gives, run from the head on a verifier folder, runs that folder's tests and exits 0, and node --test on the bare folder exits non-zero",
      "how": "The verifier's own test running both forms on a verify/ folder",
      "proof": "verifier"
    },
    {
      "id": "release-paths-named-once",
      "check": "docs/gates.md and plan/README.md decide what is released only by pointing at RELEASED in scripts/release/release.mjs, and neither lists plugins/harness/ or packages/journal/ as the released paths",
      "how": "The verifier's own test reading the two files",
      "proof": "verifier"
    },
    {
      "id": "budget",
      "check": "test/docs.test.mjs holds the three entry texts to 225 lines and passes at the head",
      "how": "The verifier runs the test and counts the lines",
      "proof": "verifier"
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
    "merges": [],
    "removes": [
      "the released-path list repeated outside release.mjs"
    ],
    "budget": 0
  },
  "non_goals": [
    "No gate or script logic changes, so no release",
    "The harness-out-of-date notice and how a thread acts on it are left to the plugin's own docs",
    "Who starts a verifier stays outside the repository's process: the builder asks whoever started it"
  ],
  "records": [
    "The fresh session's answer, as the fresh-reader-path evidence file"
  ]
}
```

## What this is

Round 6 of the refine rounds. Rounds 1 to 5 shortened the path and its texts; this round tests them on a reader. A fresh
headless session, given only a clone, was asked to build a ready item and to list where the instructions were unclear.
It got the path right and named the gaps it filled from memory; this item writes each answer once where that reader
looked for it. The decisions are in `plan/decisions/2026-11-08-refine-round-6.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/fresh-reader-gaps/`. For
`fresh-reader-path`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only this
repository, you are a new thread asked to build a ready plan item. Step by step, what do you do until it is done: which
date goes in done_on, what do you write under verify/, who writes the verdict, how do you run one verifier suite
locally, and what do you do after the merge? Cite the files." Commit the prompt and the answer as the evidence file.
