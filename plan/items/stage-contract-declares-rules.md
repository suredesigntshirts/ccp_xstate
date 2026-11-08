```json
{
  "id": "stage-contract-declares-rules",
  "title": "Let the stage contract declare verdicts, stored briefs and ref kinds",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A workflow declares, in meta.marks, the three rules the engine guessed for each model stage's output: \"verdicts\" maps a verdict field's path to the value that means the check passed (a covered list's entries as \"<list>.0.result\"), \"briefs\" lists the top-level text fields stored as their roles' briefs, and \"refs\" maps each ref { url, at } path to its kind. packages/engine/src/marks.js reads them (marksOf); the load check (stages.js checkStages), the accept-time cover check (coverGap) and accept (run/accept.js, which reads the marks from the run's pinned workflow blob) ask it, and accept no longer tests the actor's name, no stages.js code tests the words PASS or FAIL, and accept holds no GitHub or web policy: each ref kind is a checker module under packages/engine/src/refs/ (github-pr.js, web-page.js) that checks a ref and returns the fields it stamps, and STAMPED and HIDDEN are the union the kinds declare. Every model stage of the four repo workflows has its marks, their meta.actors entries are untouched and their prompts are byte-identical to main's. A stage with no entry in meta.marks is read through one function in marks.js exactly as main reads it, so items pinned to older workflows and runs prepared before keep their rules.",
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
      "what": "PARTS, pathOf, nodesOf, nodeAt, isRef, marksIn(spec, actor) and marksOf(actor, stage, defs, marks) -> { inferred, verdictAt(), isVerdict(segs), passes(field, value), verdicts(result), briefs(result), kindOf(segs, ref) }: read from the stage's meta.marks entry, or, for a stage with none, inferred as main reads it (the one place that tests the name brief, the words PASS and FAIL, or a ref's url)"
    },
    {
      "ref": "packages/engine/src/refs/index.js, packages/engine/src/refs/github-pr.js, packages/engine/src/refs/web-page.js",
      "what": "REF_KINDS, and each kind's stamps, hidden and check(ref, { path, github, web, worktree, headOf }) -> { stamp } | { refused }; STAMPED and HIDDEN as their union, in main's order"
    },
    {
      "ref": "packages/engine/src/run/store.js",
      "what": "pinnedSpec(root, run): the workflow a run was prepared from, parsed from its pinned blob, or null"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "Re-exports STAMPED and HIDDEN from refs/; checkStages checks each stage's marks name what its output holds (checkMarks), that meta.marks names only model stages, and that a marked covering stage names its entries' passing value, and asks marksOf for the verdict and the fields the chart may decide on; coverGap and uncovered take a marks reader (default: the reading without marks)"
    },
    {
      "ref": "packages/engine/src/run/accept.js",
      "what": "accept reads the run's marks from its pinned workflow (run/store.js pinnedSpec) and asks them for briefs and each ref's kind, and runs the kind's checker; refsIn, the reserved check and the order of checks stay"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/research.json, workflows/intake.json, workflows/feature.json",
      "what": "meta.marks for every model stage: the brief stages' briefs, verify's and challenge's result and lines.0.result verdicts (PASS), quick-fix's pr refs (github-pr) and research's sources.0 refs (web-page); feature's brief and intake's shape have empty marks. meta.actors and the stage files do not change"
    },
    {
      "ref": "docs/language.md, packages/engine/README.md, docs/journal.md",
      "what": "marks, verdict field, ref, ref kind and stamped field in the engine glossary (and verdict where contexts meet); a Marks section in the engine README; the brief.stored row's role is a field the marks name"
    },
    {
      "ref": "packages/engine/test/marks.test.js",
      "what": "The builder's tests: every repo stage has marks; briefs follow the marks under any stage name; a stage without marks reads as main; a verdict of any words; the load check's refusals; each kind's stamps; a web-page ref to a PR url is read as a page"
    },
    {
      "ref": "packages/engine/test/tourney/S3.test.js, verify/harness-glossary/one-meaning.test.mjs",
      "what": "The only existing assertions that change: S3's two verdict-spelling tests run on the workflows without meta.marks, the reading those spellings test; one-meaning pins the brief.stored writer to accept's loop over marks.briefs(result)"
    },
    {
      "ref": "verify/fix-refusal-hints/evidence, verify/fix-return-tool-answer/evidence, verify/fix-waiting-lines-owner/evidence, verify/fix-waiting-run-stall/evidence, verify/run-lifecycle-store/evidence",
      "what": "Done items' snapshots of main's workflow hashes (main-prompts.json, main-scenarios.json, the run-lifecycle-store trace, pre.json and run folders) re-captured for the new quick-fix, research, intake and feature hashes; every changed line is a workflow id or hash, as fix-blocked-retry's decision 9 allows for an item that changes a workflow; no assertion changes"
    }
  ],
  "expect": [
    {
      "id": "no-guessing",
      "check": "At the head, outside packages/engine/src/marks.js, no file under packages/engine/src tests an actor's name against brief (or any stage name) to decide what to store, tests a value or enum against the words PASS or FAIL (in any case) to find or judge a verdict, or calls prRef to choose how a returned ref is checked; accept.js imports nothing from effects/ and holds no GitHub or web-page policy; stages.js's STAMPED and HIDDEN come from refs/index.js",
      "how": "The verifier's grep of packages/engine/src for 'brief', PASS, FAIL, pass|fail regexps, prRef and github./web. calls, and reading accept, checkStages, coverGap and the refs modules",
      "proof": "verifier"
    },
    {
      "id": "declared-rules-hold",
      "check": "Through the real loader and hooks, at the head: a quick-fix copy whose brief stage is renamed (marks moved with it) keeps storing the named fields as briefs, with the new actor name; a brief stage whose marks name one field stores only that one; a verify stage whose verdict is an enum of other words, its marks naming the pass, loads, routes, and is held to its covered lines; an unmarked PASS/FAIL field in a marked stage is not held to the lines; a research web-page ref whose url is a GitHub PR is checked as a page; a github-pr ref is checked against GitHub and stamped as on main",
      "how": "The verifier's own tests driving the head's engine on workflow copies in temp folders",
      "proof": "verifier"
    },
    {
      "id": "marks-checked",
      "check": "The head's load check refuses, naming the stage and the path: a marks part other than verdicts, briefs and refs; a verdict path that names no enum (or const) field holding its value; a brief that is no top-level text field; a ref path that names no { url, at } or a kind not in refs/; a { url, at } in a marked stage's output whose kind the marks do not name; a marked covering stage whose marks name no <list>.0.result; a meta.marks entry naming no model stage",
      "how": "The verifier's own tests loading changed copies of the repo workflows",
      "proof": "verifier"
    },
    {
      "id": "unmarked-as-main",
      "check": "A stage with no marks is read as main reads it: for the repo workflows with meta.marks removed, and for every workflow blob pinned in the repo's committed journals, the head's load check accepts or refuses exactly as main does with the same message, and accept, given the same run folders and results (brief stage results, verdicts agreeing and disagreeing with their lines in upper and lower case, PR refs and web refs), returns, stamps, stores and journals the same as main apart from times",
      "how": "The verifier's own test calling loadWorkflow, coverGap and accept at both shas on the same inputs (verify/run-lifecycle-store and verify/fix-refusal-hints show how to drive accept from a checkout)",
      "proof": "verifier"
    },
    {
      "id": "prompts-unchanged",
      "check": "Every prompt the head renders for every stage of the four repo workflows is byte-identical to main's for the same input, the workflows' meta.actors entries and stage files are main's, and the stage bench's committed prompts still match",
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
      "check": "The builder's marks tests go red when accept stores briefs by actor name again, and when coverGap ignores the marks and compares the word PASS",
      "how": "The verifier breaks each and runs packages/engine/test/marks.test.js",
      "proof": "builder"
    },
    {
      "id": "behaviour-unchanged",
      "check": "Every test that passes on main passes at the head; the test-file diff changes only the two test files the outputs name, in the ways they name, plus the builder's new tests; and the re-captured done-suite snapshots differ from main's only in workflow ids and hashes",
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
      "marks (a workflow's meta.marks: each model stage's verdicts, briefs and refs)",
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
    "No model-facing text changes: the output schemas are untouched, so prompts are main's (prompts-unchanged), and every refusal renders the same catalogue entry as on main",
    "Stages without marks keep main's reading, in one function of marks.js; retire-pinned-legacy decides when that reading can go",
    "The rebuild's 'input.previous is a PR ref' in actors.js prepare stays: it reads an input, not a result, and is another rule for a later item",
    "The inspector does not yet show why a field is a verdict; inspector-reads-records reads the stage record",
    "nodeAt, chosen and hostSet keep recognising a ref by its { url, at } shape: in a stage with marks the load check makes every such schema have a named kind, so the shape and the marks agree"
  ],
  "records": [
    "brief.stored rows keep their kind and payload; their role is the field's name, as before for quick-fix and research"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 1600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A workflow author who marks a stage and leaves out an unrouted verdict loses the coverage check for it; decisions() still catches any verdict the chart routes on, and the engine README's Marks section says what to mark",
    "Changing the workflow files changes their pinned hash: done suites that snapshot main's hashes are re-captured (outputs), and committed journals replay on their own pinned blobs",
    "accept reads marks from the run's pinned blob; a run folder whose root lacks the blob reads its stage without marks, as main does. The engine always stores the blob when it pins (index.js loadWorkflow with a root)",
    "Marks name paths, not schema nodes, so renaming an output field without its marks is caught only by the load check (marks-checked), which runs on every load"
  ]
}
```

## What this is

Finding 5 of `plan/research/design-books-cleanup.md`. The engine's accept and load check know three things that
belong to particular workflows: that the stage named `brief` returns briefs, that a verdict is a field whose values
are the words PASS or FAIL, and how to check a PR ref against GitHub or a web ref against its page. A workflow whose
brief stage has another name, or whose verdict uses other words, silently loses the rule.

This item has the workflow declare them instead, in `meta.marks` (each model stage's verdicts, briefs and refs), and
moves each ref kind's policy into its own checker module. The engine reads the marks through
`packages/engine/src/marks.js`. A stage with no marks, which is every stage of every workflow pinned before this item,
is read there exactly as main reads it, so in-flight items keep their rules and the existing tests that build specs
inline keep passing.

The first ready contract put the marks inside the output schemas (`x-verdict`, `x-brief`, `x-ref`). Building it
showed that changes every run folder's stored schema and every stage record's Schema line, which done suites pin as
assertions, not snapshots. `meta.marks` leaves `meta.actors` and every prompt as on main, so only the workflow hashes
move, and those are snapshots that fix-blocked-retry's decision 9 lets a workflow-changing item re-capture.

The choices made writing this contract are in `plan/decisions/2026-11-07-stage-contract-declares-rules.md`.

## Done

Built in PR #173 (merged 5a12475). A separate session verified it at cc8de07: all nine Expect lines MET. Released as
harness-v0.1.38.

The contract was replanned twice before the build PR opened: #171 readied it with the marks inside the output schemas,
and #172 moved them to the workflows' `meta.marks` once building showed the in-schema shape changes stored run
schemas and Schema lines that done suites assert. Done suites' snapshots of main's workflow hashes were re-captured
(only ids and hashes changed), as fix-blocked-retry's decision 9 allows for an item that changes a workflow.

The verifier noted two load-check gaps for a later item, not failures here: `"briefs": "builder"` given as a string
passes checkMarks (it flattens the value) while marks.js reads a non-list as no briefs, so the result is accepted with
no `brief.stored` row; and `meta.marks` given as a list loads, with every stage then read as unmarked.

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
- **unmarked-as-main:** delete `meta.marks` from the repo workflows; load them, and every pinned workflow
  blob under the repo's committed journal roots, at both shas and compare outcomes. Call `coverGap` and `accept` at
  both shas on the same prepared folders and results, and compare returns, run-folder files and journal rows
  (strip times, ids and hook sessions).
- **prompts-unchanged:** render `sections()` for every stage of the four workflows at both shas with fixed inputs and
  compare the text.
- **kinds-declare-stamps:** import `refs/index.js`; accept the same PR result at both shas against the same fake
  GitHub and compare the stored blob.
- **marks-tests:** make accept store briefs when `run.actor === 'brief'` again, then separately make `coverGap`
  compare the word PASS instead of asking the marks; run `packages/engine/test/marks.test.js` and show it red.
- **behaviour-unchanged:** npm test at both shas; read the test diff, and diff each re-captured snapshot against
  main's: only workflow ids and hashes may differ.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Never run npm test in a checkout and its worktree at
once. Do not commit a journal root (`items/*.jsonl`) as evidence unless its pinned workflow blob is beside it: pack it
into one JSON file instead. Commit `verify/stage-contract-declares-rules/verdict.json` with a verdict per Expect id.
