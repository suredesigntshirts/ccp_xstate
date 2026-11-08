```json
{
  "id": "verify-regression-engine",
  "title": "Retire the engine and run suites into the regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Each of the 25 verify/ folders this item names holds only verdict.json; every test file they held is either moved to test/regression/<area>/ (area engine, run or marks, with the Expect id it proves in its first comment) or deleted with its evidence because it read source text, compared a listing or compared a stored capture, and a test that did both is split; test/regression/ has one shared helper, lib.mjs; the item's prose carries a table with one row per test file, its verdict and its reason; and no engine, plugin, workflow or script source changes.",
  "why": "Done suites that assert stored captures let code be added but never removed; the classification is per test, not a deletion pass (L-measure-then-park; research plan/research/verification-swing.md, How to classify a verifier test; decision 4). First of three parts of verify-regression-set, split by suite (plan/decisions/2026-11-08-verify-regression-split.md).",
  "serves": [
    "L-contract-names-behaviour",
    "L-measure-then-park",
    "L-count-concepts"
  ],
  "depends_on": [
    "verification-contract"
  ],
  "inputs": [
    {
      "ref": "plan/research/verification-swing.md",
      "what": "Read this first; How to classify a verifier test"
    },
    {
      "ref": "plan/decisions/2026-11-08-verification-swing.md, plan/decisions/2026-11-08-verify-regression-split.md",
      "what": "Decision 4 (done suites retire), and the split: which suites, the folder-per-area layout, the Expect header, the one helper, fixtures"
    },
    {
      "ref": "verify/engine-actor-returns, verify/engine-actors, verify/engine-cards-standin, verify/engine-effects, verify/engine-host, verify/engine-stage-contract, verify/engine-toy-run, verify/fix-blocked-card-grant, verify/fix-blocked-retry, verify/fix-finish-closes-waits, verify/fix-grant-null-repo, verify/fix-other-host-runs-effects, verify/fix-rebuild-worktree, verify/fix-reminder-wake, verify/fix-verify-issue-echo, verify/fix-waiting-wake, verify/parity-cases, verify/prompt-catalogue, verify/retire-pinned-legacy, verify/run-lifecycle-store, verify/run-names-one-module, verify/stage-contract-declares-rules, verify/stage-prompt-files, verify/wf-intake, verify/wf-quick-fix",
      "what": "The 25 suites this item retires: their tests, helpers, evidence and verdicts, and the Expect lines of the items that wrote them"
    },
    {
      "ref": "docs/language.md",
      "what": "The area names and the words for each test's header"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression/engine/, test/regression/run/, test/regression/marks/",
      "what": "The moved tests as *.test.mjs files named for the behaviour they cover (the test files of one suite may merge into one file, so its helper is inlined rather than shared); each opens with a comment `Expect: <item>/<expect-id>` for every Expect line it proves"
    },
    {
      "ref": "test/regression/lib.mjs",
      "what": "The one helper: only what two or more moved test files use; a helper one file uses is inlined into it"
    },
    {
      "ref": "test/regression/fixtures/",
      "what": "Data a moved test reads as input (a recorded transcript, a workflow under test), never a stored capture of the harness's own output to compare with"
    },
    {
      "ref": "verify/<each of the 25 suites>/",
      "what": "verdict.json only; tests, helpers, evidence, .pass listings and captures deleted"
    },
    {
      "ref": "plan/items/verify-regression-engine.md",
      "what": "A `## Regression table` section: one row per test file of the 25 suites (path, moved to <path> / split / left, one reason), and one row per suite for its other files (helpers and evidence, and where any went)"
    }
  ],
  "expect": [
    {
      "id": "table-complete",
      "check": "The item file's Regression table has exactly one row for every *.test.mjs file the 25 named verify/ folders held at the PR's base and no row for any other test file; each row's verdict is moved, split or left with a non-empty reason; every test-file path the table names as a destination exists at the head under test/regression/engine/, run/ or marks/",
      "how": "The verifier's own test listing the base's verify/ folders with git and parsing the table at the head",
      "proof": "verifier"
    },
    {
      "id": "folders-hold-verdicts",
      "check": "At the head, each of the 25 named verify/ folders holds verdict.json and no other file, and each verdict.json parses with its item field equal to the folder name",
      "how": "The verifier's own test reading the head's tree",
      "proof": "verifier"
    },
    {
      "id": "moved-pass",
      "check": "node --test over every test file under test/regression/ passes at the head with at least one passing test per file; every such file's first comment names at least one Expect line as <item>/<expect-id> where the item exists in plan/items/ and has that Expect id; no file under test/regression/ reads a path under verify/",
      "how": "The verifier's own test running node --test on the folder and reading each file's header against the plan",
      "proof": "verifier"
    },
    {
      "id": "one-helper",
      "check": "The only .mjs or .js file under test/regression/ that is not a *.test.mjs file is test/regression/lib.mjs (fixtures are data files); every name lib.mjs exports is imported by at least two test files under test/regression/",
      "how": "The verifier's own test walking the folder and parsing imports",
      "proof": "verifier"
    },
    {
      "id": "moved-bite",
      "check": "For each of the three area folders, the verifier picks a moved test, breaks the engine, run or marks behaviour it asserts in a scratch copy of the head (a transition, a store state, a mark rule), and that test file goes red; restored, it is green",
      "how": "The verifier's own test copying packages/engine and the moved test to a temp folder, editing the source and running node --test",
      "proof": "verifier"
    },
    {
      "id": "left-reasons-hold",
      "check": "For every row marked left, and every left half of a split row, the deleted test read a source or doc file and matched text, compared a .pass or reporter listing, compared output with a capture stored under verify/, or checked a retired path; the verifier records any row it disagrees with in observations and fails this line only if a left test drove the engine, a hook, a gate or the plan check and asserted on what came back without comparing it to a stored capture",
      "how": "The verifier reads each left test at the PR's base and writes a test that asserts its sample rows against the base files",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR adds, changes or deletes files only under test/regression/, under the 25 named verify/ folders, and plan/items/verify-regression-engine.md; nothing under packages/, plugins/, workflows/, scripts/, bench/ or any other verify/ folder",
      "how": "The verifier's own test reading git diff --name-only between base and head",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [
      "the per-suite helpers of 25 suites into test/regression/lib.mjs"
    ],
    "removes": [
      "stored captures of earlier output as a test oracle, for these 25 suites"
    ],
    "budget": 1
  },
  "non_goals": [
    "No engine, plugin, workflow, script or bench change, so no release",
    "No other verify/ folder changes: the plugin, inspector and journal suites are verify-regression-plugin, the rest verify-regression-set",
    "No new test of behaviour the suites did not already test; a split test keeps only what it asserted",
    "No re-capture of a deleted capture under a new name",
    "The verify model stage and workflows/quick-fix/verify.md are untouched",
    "Retiring the inferred marks reading or the brief.md fallback is retire-unmarked-reading and retire-brief-file-fallback"
  ],
  "records": [
    "The Regression table in the item file and the PR body",
    "The local suite time before and after, in the PR body, as information"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 3000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A test in another verify/ folder may read a file one of these suites holds (verify/harness-glossary reads verify/obs-live-capture/fixture; a test reads verify/engine-toy-run/evidence run folders); ci shows it, and the file moves to test/regression/fixtures/ with the test that reads it",
    "A moved test that drove the engine against a stored capture must be rewritten to assert the behaviour directly or be split; the table says which"
  ]
}
```

## What this is

The first of three parts of `verify-regression-set`, split at the replan that readied it because the whole table is
147 test files in 64 folders (`plan/decisions/2026-11-08-verify-regression-split.md`). This part takes the suites of
the engine, the run and the marks: the 25 folders the inputs name. `verify-regression-plugin` takes the plugin,
inspector and journal suites, and `verify-regression-set` takes the rest and closes the series.

Read a test, not its name (research, "How to classify a verifier test"). It **moves** when it calls the engine, the
host, a hook, the plan check or a gate on a copy or temp root and asserts on what came back or what was written. It
**leaves** when it reads a source file and matches a regex, compares a `.pass` or spec-reporter listing, hashes a
render or a scenario and compares with a stored capture, or asserts that a file equals a stored copy. A test that does
both is split: the behaving half moves, the comparing half leaves. A test that reads committed data as *input* (a
real Claude Code transcript, a recorded hook payload) moves, and its input goes to `test/regression/fixtures/`; a
capture of the harness's own earlier output is not input.

Known from the research: `stage-contract-declares-rules`'s `marks-checked` and `declared-rules-hold` move,
`run-lifecycle-store`'s `states` and `answers` scenarios move (rewritten to make their run folders rather than read
`evidence/main/`), `retire-pinned-legacy`'s `retired-not-run` moves, and the `main-prompts.json` /
`main-scenarios.json` comparisons, `evidence/main/trace.json` and every `.pass` listing leave.

Report the local suite time before and after in the PR, as information.

## Regression table

Written by the build.

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's moved tests first, write your own under `verify/verify-regression-engine/`:

- **table-complete:** list `verify/<suite>/*.test.mjs` for the 25 suites at the PR base with `git ls-tree`, parse the
  `## Regression table` at the head, compare the two sets, check each destination exists.
- **folders-hold-verdicts:** read the head tree of each of the 25 folders.
- **moved-pass:** run `node --test` on each file under `test/regression/` from a child process (drop
  `NODE_TEST_CONTEXT` from its env); parse each file's first comment for `<item>/<expect-id>` and check it against
  `plan/items/<item>.md`; grep for `verify/` paths read.
- **one-helper:** walk `test/regression/`, parse `import` lines, count importers per `lib.mjs` export.
- **moved-bite:** for one moved test in each of `engine/`, `run/` and `marks/`, copy the head to a temp folder,
  break what the test asserts in `packages/engine/src/` (or a workflow it loads), run that test there, show red;
  restore, show green.
- **left-reasons-hold:** read every left test at the base; put any row you disagree with in `observations`. Fail the
  line only for a left test that drove behaviour and asserted on the result without a stored capture.
- **scope:** `git diff --name-only <base> <head>`.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again. No
listings.
