```json
{
  "id": "comments-present-tense",
  "title": "Make harness comments state what holds now, not which item added it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Comments in the harness source (packages/engine/src, packages/engine/bin, packages/journal/src, packages/journal/bin, plugins/harness/scripts, scripts/inspector, scripts/bench) and the two READMEs (packages/engine/README.md, plugins/harness/README.md) state present-tense facts and invariants, with no plan item ids, design-letter sections, lanes, tournament rounds or grafts; the engine README describes its entry points, guarantees and files; CLAUDE.md states the rule and that a cleanup changes structure, not behaviour; and the PR gate refuses a new history reference in that source, as it refuses a TODO.",
  "why": "About 140 history references sit in harness source comments and the two READMEs (50 in packages/engine/src alone). They make every file read as an archive, they cost every agent session tokens for history it cannot use, and builders add more by habit. The why already travels with the plan item, the commit and the PR (CLAUDE.md principles). APOSD chapters 12-13 and Pragmatic's single source of truth; research plan/research/design-books-cleanup.md, finding 2.",
  "serves": [
    "L-theory-written",
    "L-count-concepts"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 2: the smell, examples (actors.js:519, 558, 560; index.js:47) and the change"
    },
    {
      "ref": "packages/engine/src, packages/engine/bin, packages/journal/src, packages/journal/bin, plugins/harness/scripts, scripts/inspector, scripts/bench",
      "what": "The source whose comments are swept"
    },
    {
      "ref": "packages/engine/README.md, plugins/harness/README.md",
      "what": "The READMEs, today written as the fixes that shaped each behaviour"
    },
    {
      "ref": "scripts/gates/lib.mjs stub ban",
      "what": "The existing pattern ban CI runs over packages/ and plugins/; the history ban joins it"
    }
  ],
  "outputs": [
    {
      "ref": "the source folders above",
      "what": "Each history comment rewritten as the invariant it protects, or deleted when the code already says it; no code token changes"
    },
    {
      "ref": "packages/engine/README.md",
      "what": "Entry points (every export of src/index.js and every bin/host.js command), the guarantees each gives, and the files it reads and writes, in present tense"
    },
    {
      "ref": "plugins/harness/README.md",
      "what": "The same sweep"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/test/",
      "what": "A history-reference ban over the swept folders, with its pattern in one place, and a builder test"
    },
    {
      "ref": "docs/layout.md",
      "what": "One paragraph: comments are present tense; item ids go in commits, PRs and the plan"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Two principles: comments say what holds now (item ids, lanes and rounds go in commits, PRs and the plan, never in code comments or READMEs); a cleanup changes structure, not behaviour (tests that pass on main pass at its head, changed only for the renames and imports its item names)"
    }
  ],
  "expect": [
    {
      "id": "no-history",
      "check": "At the head, grep -rEn 'plan item|\\((fix|engine|obs|wf|inspector|stage|prompt|probe|journal|refine)-[a-z-]+[),]|[Dd]esign [A-E],|lane [A-E]|graft|round[- ][12]|before (fix|stage|prompt)-' over the swept folders and the two READMEs (excluding vendor/) finds nothing",
      "how": "The verifier runs the grep itself",
      "proof": "verifier"
    },
    {
      "id": "code-unchanged",
      "check": "For every .js and .mjs file the PR changes outside scripts/gates/, the file with its comments removed is identical at main and at the head, and every test that passes on main passes at the head",
      "how": "The verifier's own comment-stripping comparison, and npm test at both shas",
      "proof": "verifier"
    },
    {
      "id": "readme-complete",
      "check": "packages/engine/README.md names every export of packages/engine/src/index.js and every bin/host.js command, and holds no history reference",
      "how": "The verifier's own test reading index.js exports and host.js commands",
      "proof": "verifier"
    },
    {
      "id": "gate-refuses",
      "check": "A PR adding the comment `// (plan item fix-x)` to a file under packages/engine/src fails the gates check, naming the file, line and rule; the same comment under plan/ or docs/ passes",
      "how": "A throwaway branch in ccp_xstate_scratch (or this repo, closed unmerged) and its gates check run on GitHub",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The check runs on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [
      "history-reference ban joins the stub ban as one pattern gate"
    ],
    "removes": [
      "history in code comments"
    ],
    "budget": 0
  },
  "non_goals": [
    "No code changes: only comments, the two READMEs, the gate, docs/layout.md and CLAUDE.md",
    "docs/ (journal.md names which item defines each payload, on purpose), tests, plan/, verify/ and workflow stage files are not swept",
    "No rename of any identifier, file or journal kind (harness-glossary does that)"
  ],
  "records": [
    "the gates check output naming each refused line"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A rewrite drops a real invariant the history comment carried; code-unchanged keeps behaviour, and the builder keeps the invariant when one exists",
    "The gate pattern catches a legitimate word (a test round, a lane in a pool); the pattern lives in one place and the gate names the rule, so it can be narrowed"
  ]
}
```

## What this is

Finding 2 of `plan/research/design-books-cleanup.md`. The why of a change lives in its plan item and commit; a comment says what is true now and why
it must hold. The gate makes the rule hold for later builders, who otherwise add "(plan item X)" by habit.

Rewrite rule for the builder: a comment like "(fix-rebuild-worktree)" becomes the invariant it protects ("a rebuild
works on the previous PR's branch at the head the host last saw"), or goes when the code already says it. Keep
comments that say why a non-obvious choice holds (a platform fact, a race), and drop the story of how it got there.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Without reading the builder's tests, write your
own under `verify/comments-present-tense/`:

- **no-history:** run the grep in the Expect line over the folders and READMEs named in the outcome and show it is
  empty.
- **code-unchanged:** for each changed .js/.mjs file outside scripts/gates/, strip comments with a tokenizer that
  respects strings, template literals and regexes (node's own parser through `node:vm` is not enough; use acorn from
  node_modules if present, else write a small scanner and test it on tricky inputs), and compare main and head
  byte for byte. Run `npm test` at main and at the head and compare the passing sets.
- **readme-complete:** read the export names of packages/engine/src/index.js and the commands bin/host.js accepts, and
  check that each appears in packages/engine/README.md.
- **gate-refuses:** push a throwaway branch that adds `// (plan item fix-x)` to a file under packages/engine/src,
  open a PR, read its gates check (it must fail naming the line), then close it unmerged and delete the branch. Do
  the same with the line in a plan/ file and show gates passes.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit `verify/comments-present-tense/verdict.json`
with a verdict per Expect id.
