```json
{
  "id": "verify-regression-plugin",
  "title": "Retire the plugin, inspector and journal suites into the regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Each of the 19 verify/ folders this item names holds only verdict.json; every test file they held is either moved to test/regression/<area>/ (area one of the eight of decision 4, mostly plugin, inspector or journal, with the Expect id it proves in its first comment) or deleted with its evidence because it read source text, compared a listing, compared a stored capture or only asserted a recorded past run, and a test that did both is split; moved tests share test/regression/lib.mjs; the item's prose carries a table with one row per test file, its verdict and its reason; and no engine, plugin, workflow or script source changes.",
  "why": "Second of three parts of verify-regression-set, split by suite (plan/decisions/2026-11-08-verify-regression-split.md); same rule as verify-regression-engine (L-measure-then-park; decision 4 of plan/decisions/2026-11-08-verification-swing.md).",
  "serves": [
    "L-contract-names-behaviour",
    "L-measure-then-park",
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-regression-engine",
    "rules-said-once"
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
      "ref": "verify/engine-item-views, verify/fix-agent-finish-ms, verify/fix-inspector-guard-label, verify/fix-refusal-hints, verify/fix-return-tool-answer, verify/fix-waiting-lines-owner, verify/fix-waiting-run-stall, verify/harness-glossary, verify/inspector-catalogue-entries, verify/inspector-reads-records, verify/inspector-stage-record, verify/journal-schema, verify/obs-journal-vs-world, verify/obs-live-capture, verify/obs-page, verify/obs-person-attention, verify/obs-refusal-log, verify/obs-time-and-rework, verify/workflow-inspector",
      "what": "The 19 suites this item retires: their tests, helpers, evidence and verdicts, and the Expect lines of the items that wrote them"
    },
    {
      "ref": "plan/items/verify-regression-engine.md",
      "what": "The first part's Regression table and Done note: how its rows were judged, and the observations this part acts on"
    },
    {
      "ref": "docs/language.md",
      "what": "The area names and the words for each test's header"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression/<area>/: plugin/, inspector/ and journal/ for most, and any other of the eight areas where a test fits it better",
      "what": "The moved tests as *.test.mjs files named for the behaviour they cover (the test files of one suite may merge into one file, so its helper is inlined rather than shared); each opens with a comment `Expect: <item>/<expect-id>` for every Expect line it proves"
    },
    {
      "ref": "test/regression/lib.mjs",
      "what": "The one helper: only what two or more moved test files use; a helper one file uses is inlined into it"
    },
    {
      "ref": "test/regression/fixtures/",
      "what": "Data a moved test reads as input (a recorded transcript, a workflow under test), never a stored capture of the harness's own output to compare with; the v1 journals under fixtures/v1/ stay only if a moved test reads them"
    },
    {
      "ref": "verify/<each of the 19 suites>/",
      "what": "verdict.json only; tests, helpers, evidence, .pass listings and captures deleted"
    },
    {
      "ref": "plan/items/verify-regression-plugin.md",
      "what": "A `## Regression table` section: one row per test file of the 19 suites (path, moved to <path> / split / left, one reason), and one row per suite for its other files (helpers and evidence, and where any went)"
    }
  ],
  "expect": [
    {
      "id": "table-complete",
      "check": "The item file's Regression table has exactly one row for every *.test.mjs file the 19 named verify/ folders held at the PR's base and no row for any other test file; each row's verdict is moved, split or left with a non-empty reason; every test-file path the table names as a destination exists at the head under test/regression/<area>/ for one of the eight areas of decision 4 (engine, run, marks, journal, plugin, inspector, plan, gates)",
      "how": "The verifier's own test listing the base's verify/ folders with git and parsing the table at the head",
      "proof": "verifier"
    },
    {
      "id": "folders-hold-verdicts",
      "check": "At the head, each of the 19 named verify/ folders holds verdict.json and no other file, and each verdict.json parses with its item field equal to the folder name",
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
      "check": "For each of plugin/, inspector/ and journal/ that holds a moved test, the verifier picks one, breaks the behaviour it asserts in a scratch copy of the head (a hook's answer, a page's reading of a record, a journal row's check), and that test file goes red; restored, it is green",
      "how": "The verifier's own test copying the head to a temp folder, editing the source under plugins/ or packages/ and running node --test",
      "proof": "verifier"
    },
    {
      "id": "left-reasons-hold",
      "check": "For every row marked left, and every left half of a split row, the deleted test read a source or doc file and matched text, compared a .pass or reporter listing, compared output with a capture stored under verify/, asserted facts of a recorded past run (a journal, transcript or GitHub response under verify/) without running the head's code on it, or checked a retired path; the verifier records any row it disagrees with in observations and fails this line only if a left test drove the engine, a hook, a gate or the plan check and asserted on what came back without comparing it to a stored capture",
      "how": "The verifier reads each left test at the PR's base and writes a test that asserts its sample rows against the base files",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR adds, changes or deletes files only under test/regression/, under the 19 named verify/ folders, and plan/items/verify-regression-plugin.md, except that a test or helper in another verify/ folder that read a file this PR moved or deleted changes only so it reads the new path or no longer reads that file (verify/rules-said-once/suite-and-scope.test.mjs reads verify/harness-glossary/notes.test.mjs); nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes",
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
      "the per-suite helpers of 19 suites into test/regression/lib.mjs"
    ],
    "removes": [
      "stored captures of earlier output as a test oracle, for these 19 suites"
    ],
    "budget": 1
  },
  "non_goals": [
    "No engine, plugin, workflow, script or bench change, so no release",
    "No other verify/ folder changes beyond the scope line's exception: the rest are verify-regression-set",
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
    "A test in another verify/ folder reads a file one of these suites holds: verify/rules-said-once/suite-and-scope.test.mjs reads verify/harness-glossary/notes.test.mjs in its tree mode; that test changes only so it no longer reads the moved or deleted file, which the scope line allows",
    "The recorded Claude Code transcripts the real-agent and real-session tests replay are input, not captures; they move to test/regression/fixtures/ with their tests, and the PR names each one's size",
    "A moved test that drove a hook or a page against a stored capture must be rewritten to assert the behaviour directly or be split; the table says which"
  ]
}
```

## What this is

The second of three parts of `verify-regression-set` (`plan/decisions/2026-11-08-verify-regression-split.md`). It
takes the suites of the plugin, the inspector and the journal: the 19 folders the inputs name. It runs with the rule,
Expect lines and Verifier brief of `verify-regression-engine`, changed only for the suites, the areas and the scope
line's exception.

Read a test, not its name (research, "How to classify a verifier test"). It **moves** when it calls the engine, the
host, a hook, a page's reader, the journal check, the plan check or a gate on a copy or temp root and asserts on what
came back or what was written. It **leaves** when it reads a source file and matches a regex, compares a `.pass` or
spec-reporter listing, hashes a render or a scenario and compares with a stored capture, asserts that a file equals a
stored copy, or only asserts facts of a recorded past run without running the head's code on it. A test that does both
is split. A test that reads committed data as *input* (a real Claude Code transcript, a recorded hook payload) moves,
and its input goes to `test/regression/fixtures/`.

Known now:

- The four `fix-*` suites' `main-prompts.json` / `main-scenarios.json` comparisons (`unchanged.test.mjs`) leave;
  `inspector-reads-records/no-guessing.test.mjs` is a grep and leaves; `fix-inspector-guard-label` and
  `inspector-catalogue-entries` hold no tests and keep only their verdict.
- The recorded transcripts the `real-agent` and `real-session` tests replay are input and move with their tests.
- `rules-said-once` already deleted the claude-md test from `verify/harness-glossary/notes.test.mjs`; the table's row
  for that file covers what is left in it.
- The v1 journals under `test/regression/fixtures/v1/` are read only by `verify/harness-glossary/lib.mjs`. They stay
  if a moved harness-glossary test reads them, and are deleted otherwise.
- `verify/rules-said-once/suite-and-scope.test.mjs` reads `verify/harness-glossary/notes.test.mjs` in its tree mode.
  If this PR moves or deletes that file, that one check changes so it no longer reads it (the scope line's exception).

Report the local suite time before and after in the PR, as information.

## Regression table

One row per test file the 19 folders held at the base, then one row per suite for its other files. `moved` and `split` name the file under `test/regression/` that holds the moved tests.

| Test file | Verdict | Moved to | Reason |
|---|---|---|---|
| `verify/engine-item-views/item-views.test.mjs` | split | `test/regression/inspector/item-views.test.mjs` | moved: finish-once and spans-sessions drive itemView, tokensByAgent and overhead on the first real run's rows; left: the fixture test asserts only the recorded rows |
| `verify/engine-item-views/world.test.mjs` | split | `test/regression/inspector/item-views.test.mjs` | moved: view runs itemView on the iv1 rows against hand counts; left: tagged asserts only facts of the recorded iv1 journal, and the page test reads the page's recorded browser-check output |
| `verify/fix-agent-finish-ms/long-transcript.test.mjs` | moved | `test/regression/plugin/agent-finish-ms.test.mjs` | drives the real capture hook on transcripts over the read cap and the edge cases |
| `verify/fix-agent-finish-ms/old-entry.test.mjs` | split | `test/regression/plugin/agent-finish-ms.test.mjs` | moved: the hook gives the run's own ms despite old rows; left: main's ms read from evidence/main-scenarios.json |
| `verify/fix-agent-finish-ms/real-agents.test.mjs` | left |  | asserts facts of a recorded real run; its one head-code check compares the hook's answer with the ms the harness journalled in that run, its own earlier output |
| `verify/fix-agent-finish-ms/unchanged.test.mjs` | left |  | compares every row with the stored capture evidence/main-scenarios.json |
| `verify/fix-refusal-hints/cap.test.mjs` | moved | `test/regression/engine/refusal-hints.test.mjs` | drives accept() to the refusal cap on the real engine |
| `verify/fix-refusal-hints/hint.test.mjs` | split | `test/regression/engine/refusal-hints.test.mjs` | moved: fix.hint lines equal the stage files' Output lines; left: refused compared with evidence/main-refusals.json |
| `verify/fix-refusal-hints/real-agent.test.mjs` | left |  | asserts facts of recorded agent transcripts and journals |
| `verify/fix-refusal-hints/restated.test.mjs` | moved | `test/regression/engine/refusal-hints.test.mjs` | drives accept() with restated issues on the real engine |
| `verify/fix-refusal-hints/unchanged.test.mjs` | left |  | compares render hashes with the stored capture evidence/main-prompts.json |
| `verify/fix-return-tool-answer/key-order.test.mjs` | moved | `test/regression/plugin/return-tool-answer.test.mjs` | drives the real hook and return-tool server with reordered keys |
| `verify/fix-return-tool-answer/real-agent.test.mjs` | left |  | asserts facts of a recorded agent transcript and journal |
| `verify/fix-return-tool-answer/stamped.test.mjs` | split | `test/regression/plugin/return-tool-answer.test.mjs` | moved: the hook accepts and stores stamped, the server answers accepted; left: main's answers from evidence/main-scenarios.json, and a live run against a checkout of main |
| `verify/fix-return-tool-answer/still-refuses.test.mjs` | moved | `test/regression/plugin/return-tool-answer.test.mjs` | drives the real return-tool server with changed results |
| `verify/fix-return-tool-answer/unchanged.test.mjs` | left |  | compares renders and rows with stored captures of main |
| `verify/fix-waiting-lines-owner/lines.test.mjs` | split | `test/regression/plugin/waiting-lines-owner.test.mjs` | moved: each session's lines through the real hook; left: main's lines from evidence/main-scenarios.json |
| `verify/fix-waiting-lines-owner/real-session.test.mjs` | left |  | asserts facts of a recorded headless session |
| `verify/fix-waiting-lines-owner/stall.test.mjs` | split | `test/regression/plugin/waiting-lines-owner.test.mjs` | moved: the direct answers of stall(), cannotStart() and the Stop hook; left: their rows and run files compared with evidence/main-scenarios.json |
| `verify/fix-waiting-lines-owner/unchanged.test.mjs` | left |  | compares renders and spawn answers with stored captures of main |
| `verify/fix-waiting-run-stall/block.test.mjs` | moved | `test/regression/plugin/waiting-run-stall.test.mjs` | drives the real Stop hook through host.js items |
| `verify/fix-waiting-run-stall/cannot-start.test.mjs` | moved | `test/regression/plugin/waiting-run-stall.test.mjs` | drives ccp-cannot-start through the real hook |
| `verify/fix-waiting-run-stall/cap.test.mjs` | moved | `test/regression/plugin/waiting-run-stall.test.mjs` | drives the block cap through the real hook |
| `verify/fix-waiting-run-stall/measure.test.mjs` | moved | `test/regression/plugin/waiting-run-stall.test.mjs` | runs derive.js stalls over a journal the real hook and engine made |
| `verify/fix-waiting-run-stall/real-session.test.mjs` | left |  | asserts facts of two recorded headless sessions |
| `verify/fix-waiting-run-stall/unchanged.test.mjs` | left |  | compares render hashes with the stored capture evidence/main-prompts.json |
| `verify/harness-glossary/capture.test.mjs` | split | `test/regression/journal/prompt-kinds.test.mjs` | moved: the capture hook writes v2 agent.prompt and agent.final, never brief.stored or result.stored, and spawn carries promptHash; left: rows compared with main's evidence/main/answers.json, and a regex over capture-rows.mjs source |
| `verify/harness-glossary/glossary.test.mjs` | left |  | reads docs/language.md with regexes and checks the names it lists |
| `verify/harness-glossary/notes.test.mjs` | left |  | regexes over scripts/inspector/export.mjs source (its claude-md test left with rules-said-once) |
| `verify/harness-glossary/one-meaning.test.mjs` | left |  | greps engine, journal, plugin and script source for names |
| `verify/harness-glossary/prompt.test.mjs` | split | `test/regression/journal/prompt-kinds.test.mjs` | moved: the engine writes prompt.md and a prompt.stored row, the Agent hook hands it out and binds, a brief.md-only run folder still starts; left: byte comparisons with main's evidence/main/answers.json |
| `verify/harness-glossary/v1.test.mjs` | split | `test/regression/journal/prompt-kinds.test.mjs` | moved: readFile maps every v1 journal at v2, derive.js stalls and the inspector export over v1 runs; left: their comparisons with main's evidence/main/answers.json |
| `verify/inspector-reads-records/explain-tests.test.mjs` | moved | `test/regression/inspector/reads-records.test.mjs` | runs explain.test.js in a worktree with explain.js mutated, red each time |
| `verify/inspector-reads-records/no-guessing.test.mjs` | split | `test/regression/inspector/reads-records.test.mjs` | moved: a run with stage.json and no prompt file is a model run, and a journal or engine without records is refused by name; left: two greps over scripts/inspector source |
| `verify/inspector-reads-records/one-path.test.mjs` | moved | `test/regression/inspector/reads-records.test.mjs` | exports a cut item on the checkout and on a mutated copy |
| `verify/inspector-reads-records/page.test.mjs` | moved | `test/regression/inspector/reads-records.test.mjs` | builds the page from sources.json and checks it in Chromium (skips without Playwright) |
| `verify/inspector-reads-records/records.test.mjs` | moved | `test/regression/inspector/reads-records.test.mjs` | exports every committed and scenario journal and checks it against its own replay |
| `verify/inspector-stage-record/flow.test.mjs` | moved | `test/regression/inspector/stage-record.test.mjs` | builds the page and reads the flow strip in Chromium (skips without Playwright) |
| `verify/inspector-stage-record/true-to-record.test.mjs` | moved | `test/regression/inspector/stage-record.test.mjs` | builds the page for the trial and scenarios Q1 and R1 and checks it against stage.json in Chromium; without Playwright, one added test checks the built page data against the trial's stage.json, so the file passes on CI |
| `verify/journal-schema/journal.test.mjs` | moved | `test/regression/journal/schema-writers.test.mjs` | two writer processes, an older writer and an upcast through the journal library; writer.mjs is inlined as a node -e child |
| `verify/obs-journal-vs-world/journal-check.test.mjs` | split | `test/regression/journal/journal-check.test.mjs` | moved: journal-check.js over recorded transcripts and GitHub answers; left: the fixture test asserts only the recorded inputs |
| `verify/obs-live-capture/capture.test.mjs` | split | `test/regression/plugin/live-capture.test.mjs` | moved: the capture hook replayed and run on recorded hook inputs; left: the fixture test asserts only the recorded inputs |
| `verify/obs-page/live.test.mjs` | left |  | compares hand counts with the page's recorded browser-check output and a stored published page |
| `verify/obs-person-attention/person.test.mjs` | split | `test/regression/plugin/person-attention.test.mjs` | moved: message, card and tap rows through the real hook and the attention view; left: the fixture test asserts only the recorded wake |
| `verify/obs-person-attention/rows-real.test.mjs` | split | `test/regression/plugin/person-rows-real.test.mjs` | moved: wakes rebuilt from a real thread's ids run through the real hook; left: the count test asserts only the recorded counts |
| `verify/obs-refusal-log/refusal.test.mjs` | split | `test/regression/plugin/refusal-log.test.mjs` | moved: a recorded denial through the real hook, and retryOf; left: the fixture test asserts only the probe's recorded event |
| `verify/obs-time-and-rework/verifier.test.mjs` | moved | `test/regression/journal/time-and-rework.test.mjs` | derive.js rework over GitHub's recorded answers and --append tripwires |
| `verify/workflow-inspector/generic.test.mjs` | left |  | a regex over scripts/inspector source, and two tests that run only against lane checkouts under /home/user/lanes, a retired path no checkout has |
| `verify/workflow-inspector/true-to-disk.test.mjs` | left |  | runs only against a journal under /mnt/project-files and lane checkouts under /home/user/lanes, retired paths; it always skips |
| `verify/workflow-inspector/usable.test.mjs` | left |  | runs only with the same retired journal and lane checkouts; it always skips |

| Suite | Other files |
|---|---|
| `engine-item-views` | fixtures/first-real-run.jsonl and evidence/iv1-journal.jsonl moved to test/regression/fixtures/item-views/; evidence/browser-check-iv1.json deleted |
| `fix-agent-finish-ms` | lib.mjs and scenarios.mjs inlined (longTranscript and the edge cases kept); evidence/real/journal-run1.jsonl and journal-run2.jsonl moved to test/regression/fixtures/v1/ for the v1 reads; the rest of evidence/ deleted; the probe-plugin-agents-thread transcript the lib read is copied to test/regression/fixtures/agent-transcript.jsonl |
| `fix-inspector-guard-label` | no tests; verdict only |
| `fix-refusal-hints` | lib.mjs inlined; prompts.mjs and evidence/ (main captures, recorded agent runs) deleted |
| `fix-return-tool-answer` | lib.mjs inlined; scenarios.mjs and evidence/ deleted |
| `fix-waiting-lines-owner` | lib.mjs and scenarios.mjs inlined (lines and stalls kept); evidence/ deleted |
| `fix-waiting-run-stall` | lib.mjs inlined; evidence/ deleted |
| `harness-glossary` | lib.mjs inlined; evidence/main/run/ moved to test/regression/fixtures/brief-md-run/ (a run folder with brief.md and no prompt.md, input to the fallback test); record.mjs, evidence/main/answers.json and the .pass listings deleted |
| `inspector-catalogue-entries` | no tests; evidence/ deleted |
| `inspector-reads-records` | lib.mjs inlined; evidence/ (main comparison, .pass listings, run notes) deleted |
| `inspector-stage-record` | lib.mjs inlined |
| `journal-schema` | writer.mjs inlined as a node -e child |
| `obs-journal-vs-world` | fixture/ moved to test/regression/fixtures/journal-vs-world/ |
| `obs-live-capture` | fixture/ (hook inputs and transcripts) moved to test/regression/fixtures/live-capture/; fixture/make.mjs, which made them, deleted |
| `obs-page` | fixtures/ (journal copy, browser-check outputs, published page) deleted |
| `obs-person-attention` | fixture/ moved to test/regression/fixtures/person-attention/ |
| `obs-refusal-log` | none; its input is under probes/ |
| `obs-time-and-rework` | fixtures/ (GitHub answers for PRs 14, 28 and 31) moved to test/regression/fixtures/rework/ |
| `workflow-inspector` | lib.mjs deleted |

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's moved tests first, write your own under `verify/verify-regression-plugin/`:

- **table-complete:** list `verify/<suite>/*.test.mjs` for the 19 suites at the PR base with `git ls-tree`, parse the
  `## Regression table` at the head, compare the two sets, check each destination exists.
- **folders-hold-verdicts:** read the head tree of each of the 19 folders.
- **moved-pass:** run `node --test` on each file under `test/regression/` from a child process (drop
  `NODE_TEST_CONTEXT` from its env); parse each file's first comment for `<item>/<expect-id>` and check it against
  `plan/items/<item>.md`; grep for `verify/` paths read.
- **one-helper:** walk `test/regression/`, parse `import` lines, count importers per `lib.mjs` export.
- **moved-bite:** for one moved test in each of `plugin/`, `inspector/` and `journal/` that holds one, copy the head
  to a temp folder, break what the test asserts in `plugins/harness/` or `packages/` (a hook's answer, a page's
  reader, the journal check), run that test there, show red; restore, show green.
- **left-reasons-hold:** read every left test at the base; put any row you disagree with in `observations`. Fail the
  line only for a left test that drove behaviour and asserted on the result without a stored capture.
- **scope:** `git diff --name-only <base> <head>`; for any changed file outside the 19 folders and
  `test/regression/`, show that its diff only re-points or drops the read of a file this PR moved or deleted.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again. No
listings.
