```json
{
  "id": "rules-said-once",
  "title": "Say each process rule once, and write a thread's path from ready to done",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A PR names its item only by an `Item: <id>` line in its body, so a branch name never changes what the gates demand; plan/README.md holds, in one section, the path an item takes from ready to done (the readying replan, the build PR, the verdict, the merge and release, the done replan) with each PR's branch, label and body line; every process rule has one home among CLAUDE.md, plan/README.md and docs/gates.md and the others point at it; a repo test fails when a path those texts or docs/ name in backticks does not exist or when CLAUDE.md, plan/README.md and docs/gates.md together reach 230 lines; and the done-suite tests that matched the old wording of these files leave.",
  "why": "Threads followed a working rule from project memory because CLAUDE.md's replan branch name made the gate demand a verdict, and the freeze, verdict and session rules were each written out twice, so a model reads about 270 lines of rules before its item and can find two versions of one (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-1.md).",
  "serves": [
    "L-rules-live-in-the-repo",
    "L-expect-format-one-owner",
    "L-count-concepts",
    "L-theory-written"
  ],
  "depends_on": [
    "verify-evidence-policy"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-1.md",
      "what": "Read first: the home of each rule, the Item-line decision, which book concepts this round uses and which it leaves"
    },
    {
      "ref": "CLAUDE.md, plan/README.md, docs/gates.md, docs/language.md",
      "what": "The rule texts as they stand after verify-evidence-policy merges"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/",
      "what": "namedItem and its callers, and the gate tests that pass a branch to name an item"
    },
    {
      "ref": "verify/repo-skeleton/claude-md.test.mjs, verify/verification-contract/rules-written.test.mjs, verify/fix-budget-rule/rule-written.test.mjs, verify/harness-glossary/notes.test.mjs",
      "what": "The done-suite tests that match the rule texts' wording, which leave with that wording"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/gates/lib.mjs",
      "what": "namedItem reads the body's Item line only; it refuses an Item line naming an id plan/items/ lacks, and the branch takes no part"
    },
    {
      "ref": "scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "Builder tests: a build/<id> branch with no Item line names nothing; a replan/<id> branch with a plan-only change and no Item line passes verdict; Item: <id> names the item whatever the branch"
    },
    {
      "ref": "plan/README.md",
      "what": "A section, How an item moves, giving the path from ready to done; How slop is kept out keeps each rule in a sentence and points at docs/gates.md for how the gates check it; the deny-list is named where it lives, in plan/check.mjs; Principles the plan is held to leaves (CLAUDE.md holds the principles)"
    },
    {
      "ref": "docs/gates.md",
      "what": "The home of the gates' mechanics: the verdict file, the freeze, sessions, the release; Naming the item says the body line alone names it; nothing restates plan/README.md's why"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Principles say each rule in a line with a pointer to its home; Branches and PRs points at How an item moves instead of restating it; under 100 lines"
    },
    {
      "ref": "test/docs.test.mjs",
      "what": "Fails when a repo path named in backticks in CLAUDE.md, plan/README.md or a file under docs/ does not exist (placeholders with <...> skipped), or when CLAUDE.md, plan/README.md and docs/gates.md together have 230 lines or more"
    },
    {
      "ref": "verify/repo-skeleton/claude-md.test.mjs, verify/verification-contract/rules-written.test.mjs, verify/fix-budget-rule/rule-written.test.mjs, verify/harness-glossary/notes.test.mjs",
      "what": "The first three files are deleted; in the fourth only the claude-md test leaves; test/docs.test.mjs carries the path and length checks they made"
    }
  ],
  "expect": [
    {
      "id": "item-line-names",
      "check": "In a temp git repo copied from the head, the verdict gate passes a plan-only PR on branch replan/<id of an existing item> whose body has no Item line; refuses a PR that changes a file outside plan/ on branch build/<id> with no Item line, saying the body needs an Item line; with Item: <id> in the body judges that PR against item <id>'s verdict whatever the branch is called; and refuses an Item line naming an id plan/items/ lacks",
      "how": "The verifier's own tests running node scripts/gates/pr-gate.mjs verdict in the temp repo with PR_BRANCH, PR_BODY and PR_LABELS set",
      "proof": "verifier"
    },
    {
      "id": "texts-hold-paths",
      "check": "Every repo path written in backticks in CLAUDE.md, plan/README.md and the files under docs/ exists at the head (a path holding <...> is a placeholder); CLAUDE.md has fewer than 100 lines; CLAUDE.md, plan/README.md and docs/gates.md together have fewer than 230 lines",
      "how": "The verifier's own test reading the files at the head",
      "proof": "verifier"
    },
    {
      "id": "fresh-reader-path",
      "check": "A fresh headless Claude session, given a clone of the head and only the questions in the Verifier brief, answers from the repo the branch, label, body line and files of the readying replan, the build PR, the verdict commit and the done replan of a named item, and when the PR may merge and what follows; each answer agrees with what the gates and plan/check.mjs accept at the head, and the two replans and the build PR's naming, carried out in a temp repo copied from the head with trivial changes, pass the freeze and verdict gates as answered",
      "how": "The verifier runs claude -p in a clean clone, then carries out each answer and runs the gates on it",
      "proof": "world"
    },
    {
      "id": "world-replan-branch",
      "check": "A throwaway PR in ccp_xstate based on the head (title starting throwaway:, closed unmerged), on branch replan/<id of an existing draft item>, labelled replan, changing only that item's prose, with no Item line in its body, gets a green verdict check on GitHub",
      "how": "The PR and its verdict run on GitHub",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "test/docs.test.mjs goes red when a path CLAUDE.md names is renamed and when a line is added that takes the three files to 230; scripts/gates/test/lib.test.mjs goes red when namedItem reads the branch's last segment again; each green again when restored",
      "how": "The verifier breaks each and runs the named test file",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head; the PR changes only the files the outputs name; the only verify/ changes are the three deletions and the one test removed from verify/harness-glossary/notes.test.mjs",
      "how": "The verifier runs both at the head and reads the diff's file list",
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
      "the item path (the five PRs and commits that take an item from ready to done), in one section"
    ],
    "merges": [
      "the two ways a PR names its item (branch and body line) into the body line"
    ],
    "removes": [
      "the branch-agreement refusal (the body names x but the branch names y)",
      "the second copies of the freeze, verdict and session rules"
    ],
    "budget": 1
  },
  "non_goals": [
    "No engine, plugin, workflow or stage file change, so no release",
    "The stage files under workflows/ are untouched this round: a change to model-facing words is measured on the stage bench first",
    "docs/language.md changes only if a term this item uses is missing",
    "No rule changes meaning except how a PR names its item; the gates refuse what they refused before otherwise",
    "Branch names stay a convention for people (kind/id, no claude/ prefix); nothing checks them"
  ],
  "records": [
    "The verdict gate's refusal text in CI's log when a PR outside plan/ has no Item line"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "An open PR that names its item only by branch fails the verdict gate once this merges; every open build PR carries an Item line today, and the builder checks before merging",
    "The 230-line budget is a ratchet later rounds must keep; it is set to what this build needs, not to a target, and a later item may move it with its reason"
  ]
}
```

## What this is

Round 1 of the refine rounds the person asked for on 8 Nov: make the harness's process simpler, more concise and
clearer each round, judged against the three concept summaries (Ousterhout, the Pragmatic Programmer, Evans). The
decisions, including which concepts this round uses and which it leaves, are in
`plan/decisions/2026-11-08-refine-round-1.md`.

A thread reads `CLAUDE.md`, `plan/README.md` and `docs/gates.md` before its item. Today those say the freeze rule
twice, the verdict rule twice and the session caveat twice, and nowhere say the steps from ready to done; threads
learnt the steps, and the one rule that contradicted the gate, from project memory. This item gives each rule one
home, writes the path down, and changes the gate where following the written rule broke it: the `Item:` line becomes
the one way a PR names its item (define the error out of existence, instead of documenting "don't end a replan
branch with an item id").

The homes: `CLAUDE.md` is the map and the principles, each a line with a pointer. `plan/README.md` is the plan's data
(the item head, splicing, status, the fix budget) and the item path, with the rules of "How slop is kept out" in a
sentence each. `docs/gates.md` is how the gates check those rules: the verdict file, the freeze, sessions, the release.

The four tests that leave matched sentences of these files by regex; they pinned wording, not behaviour, and would
fail on any rewrite. What they protected that matters (`CLAUDE.md` is short and its paths are real) moves into
`test/docs.test.mjs`, widened to `plan/README.md` and `docs/`, with a line budget for the three entry texts.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: every verifier
and builder result in your `verdict.json` names its test under `verify/rules-said-once/`, and the gate runs them.
Without reading the builder's tests, write your own:

- **item-line-names:** make a temp git repo from the head, commit a base and a PR branch as a PR would, and run
  `BASE_SHA=<base> node scripts/gates/pr-gate.mjs verdict` with `PR_BRANCH`, `PR_BODY` and `PR_LABELS` set. Cover the
  four cases of the check.
- **texts-hold-paths:** read `CLAUDE.md`, `plan/README.md` and every file under `docs/` at the head; collect each
  backticked token that looks like a repo path (has a `/` or ends in `.md`, `.mjs`, `.js`, `.json`, `.yml`) and holds no
  `<`; check each exists. Count the lines.
- **fresh-reader-path:** in a clean clone of the head, run a headless session (`claude -p`, with
  `CLAUDE_CODE_REMOTE_SESSION_ID` unset) with this prompt and nothing else: "Using only this repository, answer for
  the draft item `test-fixture-edges`: (1) the branch, label, body lines and files of the PR that makes it ready;
  (2) the branch and body lines of its build PR, and what every commit must end with; (3) who writes its verdict,
  where, and what the gate needs from it; (4) when the build PR may merge and what follows the merge, including the
  done replan's branch, label and changes." Then, in a temp repo from the head, carry out (1) and (4)'s done replan as
  prose-only edits and (2) as a one-line change outside `plan/`, each with the branch, label and body answered, and
  run the freeze and verdict gates on each (the build PR is refused for its missing verdict, not for its naming).
  Grade (3) against `docs/gates.md` at the head. MET when every answer holds. Commit the prompt, the answer
  and the gate outputs as the evidence file.
- **world-replan-branch:** push a throwaway branch `replan/test-fixture-edges` from the head that edits only that
  item's prose, open a PR titled "throwaway: ..." with no Item line, add the `replan` label, read the verdict check
  (re-run after labelling if the first run predates the label), close it unmerged, delete the branch.
- **tests-bite:** rename a path `CLAUDE.md` names (or edit the name in `CLAUDE.md`), run
  `node --test test/docs.test.mjs`, show red, restore; pad the three files to 230 lines, show red, restore; make
  `namedItem` fall back to the branch's last segment, run `node --test scripts/gates/test/lib.test.mjs`, show red,
  restore.
- **suite-and-scope:** `node plan/check.mjs` and `npm test` at the head; `git diff --name-status origin/main...HEAD`.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line: the command, the excerpt, and the inputs to run it again.
