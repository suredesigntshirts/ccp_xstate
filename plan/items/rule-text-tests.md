```json
{
  "id": "rule-text-tests",
  "title": "Write down that a test reads a rule text for what it says, not its sentence",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "docs/layout.md's Tests section says a test that reads a rule text (CLAUDE.md, plan/README.md, docs/) checks what the text says, by the words that carry the rule, and never matches a whole sentence, so a rewording that keeps the rule keeps the test green.",
  "why": "Round 7 rewrote step 2 of plan/README.md without changing what it says, and turned a done item's verifier suite red, because the suite matched step 2's exact sentences. Round 1 took such tests out of the repo's own suites (Evans: frozen language), but nothing tells a verifier, who writes a new suite for every item, not to write one; each wording round then pays to loosen it (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-8.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "fresh-reader-gaps"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-8.md",
      "what": "Read first: the suite that went red and why the rule sits in docs/layout.md"
    },
    {
      "ref": "docs/layout.md",
      "what": "The Tests section"
    }
  ],
  "outputs": [
    {
      "ref": "docs/layout.md",
      "what": "Tests: a test that reads a rule text checks the words that carry the rule, never a whole sentence"
    }
  ],
  "expect": [
    {
      "id": "rule-written",
      "check": "docs/layout.md's Tests section says a test reading a rule text checks the words that carry the rule and not a whole sentence",
      "how": "The verifier's own test reading the file, matching the words that carry the rule",
      "proof": "verifier"
    },
    {
      "id": "fresh-verifier-follows",
      "check": "A fresh headless Claude session given a clean clone of the head and asked, as in the Verifier brief, to write a node:test test that plan/README.md says a build PR's first commit sets status done, writes one that passes at the head and still passes when that sentence is reworded without changing what it says",
      "how": "The verifier runs claude -p in a clean clone, saves the test it writes, runs it, rewords the sentence in a scratch copy and runs it again",
      "proof": "world"
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
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "Done items' suites that match sentences stay until a round rewords what they read; that round loosens them and names them",
    "No check enforces the rule; a fresh verifier following it is the proof"
  ],
  "records": [
    "The fresh session's test and both runs, as the fresh-verifier-follows evidence file"
  ]
}
```

## What this is

Round 8 of the refine rounds, a small one beside round 7. It writes down, where a verifier looks for test rules, the
rule round 1 applied to the repo's own suites. The decisions are in `plan/decisions/2026-11-08-refine-round-8.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/rule-text-tests/`. For
`fresh-verifier-follows`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` in the clean clone with: "Using only
this repository's rules for tests, write a node:test test file that checks plan/README.md says a build PR's first commit
sets the item's status to done. Print only the file." Save its output as a test file in a scratch copy of the clone,
run it, reword that sentence in the scratch copy without changing what it says, and run it again. Commit the prompt,
the test and both results as the evidence file.
