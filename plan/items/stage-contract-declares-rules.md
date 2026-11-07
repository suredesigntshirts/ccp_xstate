```json
{
  "id": "stage-contract-declares-rules",
  "title": "Let the stage contract declare verdicts, stored briefs and ref kinds",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A model stage's output schema declares the three rules the engine guessed: a field marked \"x-verdict\": \"<value>\" is a verdict field and names its passing value (on a covered entry's result too), a top-level text field marked \"x-brief\": true is stored as that role's brief, and a { url, at } schema marked \"x-ref\": \"<kind>\" is a ref of that kind. packages/engine/src/marks.js reads them (marksOf); the load check (stages.js checkStages), the accept-time cover check (coverGap) and accept (run/accept.js) ask it, and accept no longer tests the actor's name, no stages.js code tests the words PASS or FAIL, and accept holds no GitHub or web policy: each ref kind is a checker module under packages/engine/src/refs/ (github-pr.js, web-page.js) that checks a ref and returns the fields it stamps, and STAMPED and HIDDEN are the union the kinds declare. The four repo workflows mark every verdict, brief and ref their stages return, and their prompts are byte-identical to main's. A stage that carries no mark at all is read through one function in marks.js exactly as main reads it, so items pinned to older workflows and runs prepared before keep their rules.",
  "why": "Workflow rules in the generic engine are the special-general mixture APOSD warns of and break L-rules-in-spec-not-host (research plan/research/design-books-cleanup.md, finding 5).",
  "serves": [
    "L-rules-in-spec-not-host",
    "L-count-concepts"
  ],
  "depends_on": [
    "run-lifecycle-store"
  ],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 5: the actor named brief in accept, verdictAt/WORD/isWord/mayHoldLines in the load check and coverGap, the PR and web-page policy inside accept, and the change (marks, checker modules, STAMPED as their union)"
    },
    {
      "ref": "packages/engine/src/run/accept.js",
      "what": "accept: the reserved check over refsIn, coverGap's call, the PR branch (prRef, github.pull, headOf, key, branch, checkout, gates, green, FILES_PAGE, GREEN), the web-page branch, and the brief.stored loop under run.actor === 'brief'"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "STAMPED, HIDDEN, printed (the Output schema line), WORD, isWord, verdictAt, the coverage part of checkStages, coverGap and uncovered"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/research.json, workflows/intake.json, workflows/feature.json",
      "what": "The stages' output schemas and meta.schemas: brief fields, result enums, the line entries' result, prRef and ref"
    },
    {
      "ref": "packages/engine/messages.md",
      "what": "ref-no-pr, ref-unreadable, ref-head, ref-worktree, ref-page, covers-disagrees: the refusals the checkers and the cover check render, unchanged"
    },
    {
      "ref": "docs/language.md, packages/engine/README.md, docs/journal.md",
      "what": "The engine glossary, the Actors section of the engine README, and the brief.stored row"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/marks.js",
      "what": "MARKS, nodesOf, marked(stage, defs), and marksOf(actor, stage, defs) -> { inferred, verdictAt(), isVerdict(segs), passes(field, value), verdicts(result), briefs(result), kindOf(segs, ref) }: read from the marks, or, for a stage with no mark, inferred as main reads it (the one place that tests the name brief, the words PASS and FAIL, or a ref's url)"
    },
    {
      "ref": "packages/engine/src/refs/index.js, packages/engine/src/refs/github-pr.js, packages/engine/src/refs/web-page.js",
      "what": "REF_KINDS, and each kind's stamps, hidden and check(ref, { path, github, web, worktree, headOf }) -> { stamp } | { refused }; STAMPED and HIDDEN as their union, in main's order"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "Re-exports STAMPED and HIDDEN; printed leaves out the marks; checkStages checks each mark sits where it means something (checkMarks) and asks marksOf for the verdict and the fields the chart may decide on; coverGap and uncovered take defs and ask marksOf"
    },
    {
      "ref": "packages/engine/src/run/accept.js",
      "what": "accept asks marksOf for briefs and each ref's kind, and runs the kind's checker; refsIn, the reserved check and the order of checks stay"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/research.json, workflows/intake.json",
      "what": "x-brief on the brief stages' role fields, x-verdict \"PASS\" on verify's and challenge's result and on the line entries' result, x-ref github-pr on prRef and web-page on research's ref; feature.json needs no mark"
    },
    {
      "ref": "docs/language.md, packages/engine/README.md, docs/journal.md",
      "what": "mark, verdict field, ref, ref kind and stamped field in the engine glossary (and verdict where contexts meet); a Marks section in the engine README; the brief.stored row's role is the marked field"
    },
    {
      "ref": "packages/engine/test/marks.test.js",
      "what": "The builder's tests: the repo workflows are marked; prompts print no mark; briefs follow x-brief under any stage name; a verdict of any words; the load check's refusals; each kind's stamps; a web-page ref to a PR url is read as a page; an unmarked stage reads as main"
    },
    {
      "ref": "packages/engine/test/tourney/contract.js, packages/engine/test/tourney/S3.test.js, packages/engine/test/tourney/S5.test.js, verify/harness-glossary/one-meaning.test.mjs",
      "what": "The only existing tests that change: contract.js's own printed-schema helper leaves out the marks too; S3's two verdict-spelling tests run on the workflows with their marks removed, the reading those spellings test; S5 passes the workflow's defs to uncovered; one-meaning pins the brief.stored writer to accept's loop over marks.briefs(result)"
    }
  ],
  "expect": [
    {
      "id": "no-guessing",
      "check": "At the head, outside packages/engine/src/marks.js, no file under packages/engine/src tests an actor's name against brief (or any stage name) to decide what to store, tests a value or enum against the words PASS or FAIL (in any case), or calls prRef to choose how a returned ref is checked; accept.js imports nothing from effects/ and holds no GitHub or web-page policy; stages.js's STAMPED and HIDDEN come from refs/index.js",
      "how": "The verifier's grep of packages/engine/src for 'brief', PASS, FAIL, pass|fail regexps, prRef and github./web. calls, and reading accept, checkStages, coverGap and the refs modules",
      "proof": "verifier"
    },
    {
      "id": "declared-rules-hold",
      "check": "Through the real loader and hooks, at the head: a quick-fix copy whose brief stage is renamed keeps storing the marked fields as briefs, with the new actor name; a brief stage with one field unmarked stores only the marked one; a verify stage whose verdict is an enum of other words with x-verdict naming the pass loads, routes, and is held to its covered lines; an unmarked PASS/FAIL field in a marked stage is not held to the lines; a research web-page ref whose url is a GitHub PR is checked as a page; a github-pr ref is checked against GitHub and stamped as on main",
      "how": "The verifier's own tests driving the head's engine on workflow copies in temp folders",
      "proof": "verifier"
    },
    {
      "id": "marks-checked",
      "check": "The head's load check refuses, naming the stage and the output path: an x-verdict whose value is not one of the field's values or on a field with no enum; an x-brief not true or not on a top-level text field; an x-ref naming no kind in refs/ or on a schema that is no { url, at }; a { url, at } schema without x-ref in a stage with marks; a covered list whose entries' result has no x-verdict in a stage with marks",
      "how": "The verifier's own tests loading changed copies of the repo workflows",
      "proof": "verifier"
    },
    {
      "id": "unmarked-as-main",
      "check": "A stage with no mark is read as main reads it: for the repo workflows with every mark removed, and for every workflow blob pinned in the repo's committed journals, the head's load check accepts or refuses exactly as main does with the same message, and accept, given the same run folders and results (brief stage results, verdicts agreeing and disagreeing with their lines in upper and lower case, PR refs and web refs), returns, stamps, stores and journals the same as main apart from times",
      "how": "The verifier's own test calling loadWorkflow, coverGap and accept at both shas on the same inputs (verify/run-lifecycle-store and verify/fix-refusal-hints show how to drive accept from a checkout)",
      "proof": "verifier"
    },
    {
      "id": "prompts-unchanged",
      "check": "Every prompt the head renders for every stage of the four repo workflows is byte-identical to main's for the same input, and the stage bench's committed prompts still match",
      "how": "The verifier renders sections() at both shas for each stage with fixed inputs and compares; npm test covers verify/stage-bench",
      "proof": "verifier"
    },
    {
      "id": "kinds-declare-stamps",
      "check": "refs/index.js's REF_KINDS holds github-pr and web-page; STAMPED equals the union of their stamps in main's order (key, gates, green, checkout, branch) and HIDDEN the union of their hidden; a github-pr result stored at the head has its stamped fields in the same order and values as main's, so its blob hash is the same",
      "how": "The verifier imports refs/index.js and compares a stamped PR result blob at both shas from the same fake GitHub",
      "proof": "verifier"
    },
    {
      "id": "marks-tests",
      "check": "The builder's marks tests go red when accept stores briefs by actor name again, and when coverGap ignores x-verdict and compares the word PASS",
      "how": "The verifier breaks each and runs packages/engine/test/marks.test.js",
      "proof": "builder"
    },
    {
      "id": "behaviour-unchanged",
      "check": "Every test that passes on main passes at the head, and the test-file diff changes only the four test files the outputs name, in the ways they name, plus the builder's new tests",
      "how": "npm test at both shas, and the verifier's reading of the test diff",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The check runs on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "mark (x-verdict, x-brief, x-ref in a stage's output schema)",
      "ref kind (a checker module that declares its stamped fields)"
    ],
    "merges": [
      "STAMPED and HIDDEN into the union the ref kinds declare"
    ],
    "removes": [
      "the brief stage known by its actor name",
      "a verdict guessed from the words PASS and FAIL",
      "GitHub PR and web-page policy inside accept"
    ],
    "budget": 2
  },
  "non_goals": [
    "No model-facing text changes: prompts print the output without marks (prompts-unchanged), and every refusal renders the same catalogue entry as on main",
    "Stages without marks keep main's reading, in one function of marks.js; retire-pinned-legacy decides when that reading can go",
    "The rebuild's 'input.previous is a PR ref' in actors.js prepare stays: it reads an input, not a result, and is another rule for a later item",
    "The inspector does not yet show why a field is a verdict; inspector-reads-records reads the stage record",
    "nodeAt, chosen and hostSet keep recognising a ref by its { url, at } shape: in a stage with marks the load check makes every such schema carry x-ref, so the shape and the mark agree"
  ],
  "records": [
    "brief.stored rows keep their kind and payload; their role is the marked field's name, as before for quick-fix and research"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 1600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A workflow author who marks some fields and forgets a verdict loses the coverage check for an unrouted verdict; decisions() still catches any verdict the chart routes on, and the Marks section of the engine README says what a marked stage must mark",
    "Changing the workflow files changes their pinned hash; tests that compare item rows across shas strip or re-pin the workflow id, and committed journals replay on their own pinned blobs",
    "uncovered(schema, input, result) called without defs on a marked stage whose entries' result is a $ref finds no x-verdict; every engine caller passes run.defs, and the one test caller is changed to pass them"
  ]
}
```

## What this is

Finding 5 of `plan/research/design-books-cleanup.md`. The engine's accept and load check know three things that
belong to particular workflows: that the stage named `brief` returns briefs, that a verdict is a field whose values
are the words PASS or FAIL, and how to check a PR ref against GitHub or a web ref against its page. A workflow whose
brief stage has another name, or whose verdict uses other words, silently loses the rule.

This item has the stage contract declare them instead, with three marks in the output schema, and moves each ref
kind's policy into its own checker module. The engine reads the marks through `packages/engine/src/marks.js`.
A stage with no mark at all, which is every stage of every workflow pinned before this item, is read there exactly
as main reads it, so in-flight items keep their rules and the existing tests that build specs inline keep passing.

The choices made writing this contract are in `plan/decisions/2026-11-07-stage-contract-declares-rules.md`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Keep a second clone at its base on main. Without
reading the builder's tests, write your own under `verify/stage-contract-declares-rules/`:

- **no-guessing:** grep `packages/engine/src` (outside `marks.js`) for `'brief'`, `PASS`, `FAIL`, `pass|fail`
  patterns, `prRef` and calls on `github` or `web`; read `accept`, `checkStages`, `coverGap` and `refs/`.
- **declared-rules-hold:** copy the repo's `workflows/` to a temp folder, change one workflow per case, load it by
  name with the head's `loadWorkflow`, start an item and drive its runs with the head's hooks (verify/engine-actors
  and verify/fix-refusal-hints show how; a renamed stage needs its stage file's title changed too). Use a fake GitHub
  (packages/engine/test/tourney/world.js) and a fake web client.
- **marks-checked:** load changed copies and match each refusal's message.
- **unmarked-as-main:** strip every key starting `x-` from the repo workflows; load them, and every pinned workflow
  blob under the repo's committed journal roots, at both shas and compare outcomes. Call `coverGap` and `accept` at
  both shas on the same prepared folders and results, and compare returns, run-folder files and journal rows
  (strip times, ids and hook sessions).
- **prompts-unchanged:** render `sections()` for every stage of the four workflows at both shas with fixed inputs and
  compare the text.
- **kinds-declare-stamps:** import `refs/index.js`; accept the same PR result at both shas against the same fake
  GitHub and compare the stored blob.
- **marks-tests:** make accept store briefs when `run.actor === 'brief'` again, then separately make `coverGap`
  compare the word PASS instead of asking the marks; run `packages/engine/test/marks.test.js` and show it red.
- **behaviour-unchanged:** npm test at both shas; read the test diff.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Never run npm test in a checkout and its worktree at
once. Do not commit a journal root (`items/*.jsonl`) as evidence unless its pinned workflow blob is beside it: pack it
into one JSON file instead. Commit `verify/stage-contract-declares-rules/verdict.json` with a verdict per Expect id.
