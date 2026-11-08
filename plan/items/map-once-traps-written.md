```json
{
  "id": "map-once-traps-written",
  "title": "Keep one map of the repo and write the container traps down",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "CLAUDE.md's Layout table is the one map of the repo: it names every top-level folder and every folder under scripts/, docs/layout.md keeps only its rules (tests, comments, dependencies) and points at the map, and test/docs.test.mjs fails when a top-level folder or a scripts/ folder is missing from the map; docs/traps.md names each trap a thread meets in the cloud container (signed commits in evidence, shallow clones, a headless session inheriting the thread's session id, running the suite in a checkout and its worktree at once) with the command that avoids it, and CLAUDE.md points at it; verdict.yml stops setting PR_BRANCH, which no gate reads.",
  "why": "Two maps of the repo disagree (docs/layout.md's tree and CLAUDE.md's table each miss folders the other names, and neither names scripts/release/, scripts/clean-room/ or probes/), and the container traps every builder and verifier meets live only in project memory, so a thread without that memory loses a round to each (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-3.md).",
  "serves": [
    "L-rules-live-in-the-repo",
    "L-expect-format-one-owner"
  ],
  "depends_on": [
    "rules-said-once"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-3.md",
      "what": "Read first: the traps to write and why each is in the repo, not memory"
    },
    {
      "ref": "CLAUDE.md, docs/layout.md, test/docs.test.mjs",
      "what": "The two maps and the docs test that holds the rule texts"
    },
    {
      "ref": ".github/workflows/verdict.yml",
      "what": "The PR_BRANCH environment line"
    }
  ],
  "outputs": [
    {
      "ref": "CLAUDE.md",
      "what": "The Layout table names every top-level folder and every scripts/ folder, one row each or grouped; a line points at docs/traps.md; still under 100 lines and inside the entry-text budget"
    },
    {
      "ref": "docs/layout.md",
      "what": "Its folder tree leaves; it opens by pointing at CLAUDE.md's Layout table and keeps Tests, Comments and Dependencies"
    },
    {
      "ref": "docs/traps.md",
      "what": "One short entry per container trap: what goes wrong, how it shows, and the command that avoids it"
    },
    {
      "ref": "test/docs.test.mjs",
      "what": "A test that fails when a top-level folder (other than .git, node_modules and dot folders but .github) or a folder under scripts/ is not named in CLAUDE.md's Layout table"
    },
    {
      "ref": ".github/workflows/verdict.yml",
      "what": "PR_BRANCH leaves the job's environment"
    }
  ],
  "expect": [
    {
      "id": "map-complete",
      "check": "At the head, every top-level folder (dot folders other than .github, node_modules and .git excepted) and every folder under scripts/ is named in backticks in CLAUDE.md's Layout table, docs/layout.md holds no fenced folder tree, and the docs test passes; in a temp copy of the head with a new folder scripts/x added, node --test test/docs.test.mjs fails naming scripts/x",
      "how": "The verifier's own test reading the files at the head and running the docs test on a temp copy",
      "proof": "verifier"
    },
    {
      "id": "traps-answered",
      "check": "A fresh headless Claude session given a clone of the head and only the questions in the Verifier brief (how to commit evidence whose sha you will quote in this container, what to do when a test says a commit is a shallow boundary, how to run claude -p from inside a thread session, and whether to run npm test in a checkout and its worktree together) answers each from the repo with a command or rule that works when the verifier tries it in the container",
      "how": "The verifier runs claude -p in a clean clone and tries each answer",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "test/docs.test.mjs goes red when the scripts/gates/ row is taken out of CLAUDE.md's Layout table, and green again when restored",
      "how": "The verifier breaks it and runs the test file",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head, the verdict workflow file sets no PR_BRANCH, and the PR changes only the files the outputs name and its own plan item",
      "how": "The verifier runs both, reads verdict.yml and the diff's file list",
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
      "the two maps of the repo into CLAUDE.md's Layout table"
    ],
    "removes": [
      "docs/layout.md's folder tree",
      "the PR_BRANCH variable no gate reads"
    ],
    "budget": 0
  },
  "non_goals": [
    "No gate, engine, plugin or workflow logic changes, so no release",
    "Traps that a code change could remove are named, not fixed here; each fix is its own item"
  ],
  "records": [
    "The docs test's output on the PR's ci run"
  ],
  "step_back": {
    "max_rounds": 2
  },
  "verifier": "A separate session, using the Verifier brief below."
}
```

## What this is

Round 3 of the refine rounds. Round 1 gave each process rule one home; this round does the same for the map of the
repo and for the container traps, which threads learnt from project memory. The decisions are in
`plan/decisions/2026-11-08-refine-round-3.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/map-once-traps-written/`
without reading the builder's. For `traps-answered`, run `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` with:
"Using only this repository, answer: (1) in this cloud container, how do I make a commit whose sha I will quote as
evidence? (2) a test fails saying a commit is a shallow boundary: what do I do? (3) how do I run claude -p from inside
a thread's session so its rows are not filed under the thread? (4) may I run npm test in a checkout and its git
worktree at the same time?" Try (1) to (3) in the container; grade (4) against the repo. Commit the prompt, the answer
and what you tried as the evidence file.

## Done

Built in #220 and verified 5/5 by a separate session (`verify/map-once-traps-written/verdict.json`). The verifier
found one error left in `docs/traps.md`: it says CI checks out full history, while `ci.yml` checks out at depth 1.
`done-with-the-build` corrects it.
