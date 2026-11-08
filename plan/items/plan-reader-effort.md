```json
{
  "id": "plan-reader-effort",
  "title": "Measure what a change costs its reader",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "For any merged PR, one command reports the files it touched, the exports it added or removed, the lines a reader must open to follow the change (the changed hunks plus the definitions they call), and the verifier lines and evidence lines it added, split code, tests, verifier, evidence and docs; a done build item records that report in a reader_effort head field beside its fix budget fields, the plan check refuses a build item with a verdict file and done on or after 2026-11-09 without one, and recording it is not a contract change.",
  "why": "The 8 Nov review counted by hand what the plan should count, and the cleanups passed every gate while growing (complexity is what the reader experiences; research plan/research/verification-swing.md, item 7).",
  "serves": [
    "L-count-concepts",
    "L-harness-overhead"
  ],
  "depends_on": [
    "verification-contract"
  ],
  "inputs": [
    {
      "ref": "plan/research/verification-swing.md",
      "what": "Read this first; the short version and item 7 say what the hand count measured and why"
    },
    {
      "ref": "plan/decisions/2026-11-08-plan-reader-effort.md",
      "what": "The readying choices: a script, the five categories and their path rules, how reader lines are counted, the head field and its cutoff date"
    },
    {
      "ref": "plan/check.mjs, plan/item.schema.json, test/plan-check.test.mjs",
      "what": "The plan check and head schema the field and rule sit beside, next to module and done_on"
    },
    {
      "ref": "scripts/gates/lib.mjs contract, scripts/gates/test/lib.test.mjs",
      "what": "The frozen part of an item head, which leaves out status and done_on and must also leave out reader_effort"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/reader-effort.mjs",
      "what": "node scripts/reader-effort.mjs <pr-number | base..head> [--json] reads git only and prints the report; --json prints exactly the object the reader_effort field holds"
    },
    {
      "ref": "scripts/reader-effort.test.mjs",
      "what": "The builder's tests, on temp git repos"
    },
    {
      "ref": "plan/item.schema.json",
      "what": "reader_effort: an optional object of integers (pr, files, exports_added, exports_removed, reader_lines, and added and removed per category), no other fields"
    },
    {
      "ref": "plan/check.mjs",
      "what": "Refuses a done build item whose done_on is 2026-11-09 or later, that has verify/<item>/verdict.json and no reader_effort, naming the item and the command to run"
    },
    {
      "ref": "scripts/gates/lib.mjs",
      "what": "contract() leaves reader_effort out of the frozen head, beside status and done_on"
    },
    {
      "ref": "plan/README.md, docs/gates.md, docs/language.md",
      "what": "The head-field table and the done step name reader_effort and the command; the freeze section lists it with status and done_on; the glossary gains reader effort"
    }
  ],
  "expect": [
    {
      "id": "real-prs",
      "check": "In a full clone of suredesigntshirts/ccp_xstate, the command run on merged PRs 189 and 192 prints, for each, a file count equal to the number of paths git diff --no-renames --name-only lists between the merge commit's first parent and the merge commit, and added and removed totals across the five categories equal to git diff --no-renames --numstat's totals for the same pair",
      "how": "The verifier runs the command and git on the real history and compares the numbers",
      "proof": "world"
    },
    {
      "id": "categories",
      "check": "In a temp git repo whose branch adds lines to a source file, a test file outside verify/, a test file under verify/<item>/, a non-test file under verify/<item>/, a markdown file and a workflow stage file, the --json report counts each file's added and removed lines in the category the decision's path rules give it (the stage file and packages/engine/messages.md count as code), and a PR-number argument finds the range from a merge commit titled Merge pull request #N",
      "how": "The verifier's own tests building temp repos and running the command",
      "proof": "verifier"
    },
    {
      "id": "exports",
      "check": "In a temp repo, a branch that adds an export function, an export const, an export { a as b } and an export default to code files and removes one existing export reports exports_added 4 and exports_removed 1; exports in test and verifier files are not counted",
      "how": "The verifier's own tests in a temp repo",
      "proof": "verifier"
    },
    {
      "id": "reader-lines",
      "check": "In a temp repo, a changed hunk that calls a function defined in a file the branch does not change raises reader_lines by that definition's line count once, however many times it is called; a call to a name the repo does not define adds nothing; a definition the branch itself adds is not counted twice; evidence lines are not in reader_lines",
      "how": "The verifier's own tests in a temp repo",
      "proof": "verifier"
    },
    {
      "id": "plan-rule",
      "check": "On a temp copy of the head's plan/, check.mjs refuses (exit 1, naming the item) a done build item with done_on 2026-11-09 or later, a verify/<item>/verdict.json beside the copy, and no reader_effort, and one whose reader_effort has an unknown field or a non-integer value; it passes the same item with a well-formed reader_effort, the same item with no verdict file (a test's made-up item), a done build item with an earlier done_on, and a done probe item with neither",
      "how": "The verifier's own tests copying plan/ to a temp folder and editing heads",
      "proof": "verifier"
    },
    {
      "id": "not-a-contract-change",
      "check": "The freeze gate, run in a temp repo on a PR that only adds reader_effort and status done to an item whose verify/<item>/verdict.json exists at the base, passes; the same PR that also changes one Expect check is refused naming the item",
      "how": "The verifier's own tests driving BASE_SHA=... node scripts/gates/pr-gate.mjs freeze in a temp repo",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "scripts/reader-effort.test.mjs goes red when the categoriser files every path as code, and green again when restored",
      "how": "The verifier breaks the categoriser and runs the test file",
      "proof": "builder"
    },
    {
      "id": "rules-written",
      "check": "plan/README.md's head-field table and done step name reader_effort and the command; docs/gates.md's freeze section names reader_effort among the fields a frozen item may change; docs/language.md defines reader effort",
      "how": "The verifier reads the three files",
      "proof": "verifier"
    },
    {
      "id": "plan-and-suite-pass",
      "check": "node plan/check.mjs passes on the head's real plan; npm test passes at the head; the PR changes only the files the outputs name and no verify/ folder of another item",
      "how": "The verifier runs both at the head and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "after_landing": [
    "This item's own done replan runs the command on its build PR and records the result in reader_effort"
  ],
  "concepts": {
    "adds": [
      "reader effort (the lines a reader opens to follow a change: its changed hunks plus the definitions they call)"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "No plugin or engine change, so no release",
    "No journal record and no derived view under packages/journal/: the numbers come from git",
    "No gate refuses a PR for its numbers; the report is a measure, and a ceiling is a later decision",
    "No backfill of items done before 2026-11-09; their heads stay as they are",
    "Reader lines are a heuristic over top-level definitions, not a call graph; methods, re-exports and dynamic calls are not followed"
  ],
  "records": [
    "reader_effort in each done build item's head, from the command's --json output"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The verifier's tests run in ci.yml's depth-1 checkout, so they build temp repos; only the world line reads the real history, and needs git fetch --unshallow",
    "rules-said-once (#202) rewrites plan/README.md and docs/gates.md; the build waits for it to merge before touching either"
  ]
}
```

## What this is

The 8 Nov review of the seven design-books cleanups (`plan/research/verification-swing.md`) counted, by hand, the
files each PR touched, the exports it added, and how much of what it added was code, tests, verifier tests and
evidence. Every cleanup passed every gate while the harness grew, because no gate saw those numbers. This item makes
the count one command and records it on every done build item, so the next review reads it instead of counting.

The choices made while readying it are in `plan/decisions/2026-11-08-plan-reader-effort.md`: a script under
`scripts/` that reads git, five categories by path, reader lines as hunks plus called top-level definitions, and a
head field beside `module` and `done_on` that the plan check requires of verified items done from 2026-11-09.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: every verifier
and builder result in your `verdict.json` names its test, and the gate runs it in a depth-1 checkout, so your tests
build their own temp git repos and never read this repository's history. Without reading the builder's tests, write
your own under `verify/plan-reader-effort/`:

- **real-prs:** `git fetch --unshallow origin` if needed; find the merge commits of PRs 189 and 192 on `main`; run
  `node scripts/reader-effort.mjs 189 --json` and the same for 192; compare files and the category totals with
  `git diff --no-renames --name-only` and `--numstat` between each merge's first parent and the merge. Commit one small evidence file with
  the commands and the numbers.
- **categories, exports, reader-lines:** in temp repos (`git init`, commit a base, branch, commit, merge with
  `--no-ff -m "Merge pull request #7 from x/y"`), run the command with the range and with the PR number. Take the
  path rules from the decision file, not from the script.
- **plan-rule:** copy the head's `plan/` to a temp folder, edit or add heads, add `verify/<id>/verdict.json` beside
  it where the line needs one, run `node <temp>/plan/check.mjs`.
- **not-a-contract-change:** a temp repo from the head with a base holding an item and its verdict file, and a
  branch changing the head; run `BASE_SHA=<base> node scripts/gates/pr-gate.mjs freeze` with the PR environment the
  gate reads.
- **tests-bite:** make the categoriser return code for every path, run `node --test scripts/reader-effort.test.mjs`,
  show red, restore.
- **rules-written:** read the three files.
- **plan-and-suite-pass:** `node plan/check.mjs` and `npm test` at the head; read the diff's file list.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line: the command, the excerpt, and the inputs to run it again.
