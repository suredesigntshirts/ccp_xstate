```json
{
  "id": "verify-regression-engine",
  "title": "Retire the engine and run suites into the regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Each of the 26 verify/ folders this item names holds only verdict.json; every test file they held is either moved to test/regression/<area>/ (area one of the eight of decision 4, mostly engine, run or marks, with the Expect id it proves in its first comment) or deleted with its evidence because it read source text, compared a listing or compared a stored capture, and a test that did both is split; test/regression/ has one shared helper, lib.mjs; the item's prose carries a table with one row per test file, its verdict and its reason; and no engine, plugin, workflow or script source changes.",
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
      "ref": "verify/engine-actor-returns, verify/engine-actors, verify/engine-cards-standin, verify/engine-effects, verify/engine-host, verify/engine-stage-contract, verify/engine-toy-run, verify/fix-blocked-card-grant, verify/fix-blocked-retry, verify/fix-finish-closes-waits, verify/fix-grant-null-repo, verify/fix-other-host-runs-effects, verify/fix-rebuild-worktree, verify/fix-reminder-wake, verify/fix-verify-issue-echo, verify/fix-waiting-wake, verify/parity-cases, verify/prompt-catalogue, verify/retire-pinned-legacy, verify/run-lifecycle-store, verify/run-names-one-module, verify/stage-bench, verify/stage-contract-declares-rules, verify/stage-prompt-files, verify/wf-intake, verify/wf-quick-fix",
      "what": "The 26 suites this item retires: their tests, helpers, evidence and verdicts, and the Expect lines of the items that wrote them"
    },
    {
      "ref": "docs/language.md",
      "what": "The area names and the words for each test's header"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression/<area>/: engine/, run/ and marks/ for most, and plan/ or gates/ for a test of a repo rule",
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
      "ref": "verify/<each of the 26 suites>/",
      "what": "verdict.json only; tests, helpers, evidence, .pass listings and captures deleted"
    },
    {
      "ref": "plan/items/verify-regression-engine.md",
      "what": "A `## Regression table` section: one row per test file of the 26 suites (path, moved to <path> / split / left, one reason), and one row per suite for its other files (helpers and evidence, and where any went)"
    }
  ],
  "expect": [
    {
      "id": "table-complete",
      "check": "The item file's Regression table has exactly one row for every *.test.mjs file the 26 named verify/ folders held at the PR's base and no row for any other test file; each row's verdict is moved, split or left with a non-empty reason; every test-file path the table names as a destination exists at the head under test/regression/<area>/ for one of the eight areas of decision 4 (engine, run, marks, journal, plugin, inspector, plan, gates)",
      "how": "The verifier's own test listing the base's verify/ folders with git and parsing the table at the head",
      "proof": "verifier"
    },
    {
      "id": "folders-hold-verdicts",
      "check": "At the head, each of the 26 named verify/ folders holds verdict.json and no other file, and each verdict.json parses with its item field equal to the folder name",
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
      "check": "For each of engine/, run/ and marks/, the verifier picks a moved test, breaks the engine, run or marks behaviour it asserts in a scratch copy of the head (a transition, a store state, a mark rule), and that test file goes red; restored, it is green",
      "how": "The verifier's own test copying packages/engine and the moved test to a temp folder, editing the source and running node --test",
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
      "check": "The PR adds, changes or deletes files only under test/regression/, under the 26 named verify/ folders, and plan/items/verify-regression-engine.md, except that a test or helper in another verify/ folder that read a file this PR moved to test/regression/fixtures/ changes only that path; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes",
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
      "the per-suite helpers of 26 suites into test/regression/lib.mjs"
    ],
    "removes": [
      "stored captures of earlier output as a test oracle, for these 26 suites"
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
    "A test in another verify/ folder reads a file one of these suites holds (verify/harness-glossary/lib.mjs reads the v1 journals under verify/engine-toy-run/evidence); the file moves to test/regression/fixtures/ and that one path changes, which the scope line allows",
    "A moved test that drove the engine against a stored capture must be rewritten to assert the behaviour directly or be split; the table says which"
  ]
}
```

## What this is

The first of three parts of `verify-regression-set`, split at the replan that readied it because the whole table is
147 test files in 64 folders (`plan/decisions/2026-11-08-verify-regression-split.md`). This part takes the suites of
the engine, the run and the marks, and `stage-bench`, whose `edit-safe` test lists the journals other folders here
hold: the 26 folders the inputs name. `verify-regression-plugin` takes the plugin,
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

One row per test file the 26 suites held. *moved* means every test in the file moved; *split* means the behaving
tests moved and the rest left, each half named; *left* means the file was deleted. Several rows point at one
destination where a suite's test files merged into one file, so the suite's helper is inlined rather than shared.

| Suite | Test file | Verdict | Moved to | Reason |
|---|---|---|---|---|
| `engine-actor-returns` | `actor-returns.test.mjs` | moved | `test/regression/run/actor-returns.test.mjs` | drives the actor hook script on SubagentStop and handback inputs and asserts the run, refusal rows and item state; the recorded handback tail is input and went to fixtures/handback-tail.jsonl |
| `engine-actor-returns` | `world.test.mjs` | left |  | asserts what the recorded journals of two past runs (ar2, ar4) hold, running no head code |
| `engine-actors` | `actors.test.mjs` | split | `test/regression/run/accept.test.mjs` | moved: wrong-caller, schema, ref and url tests drive accept() against a local GitHub stand-in, and the two return-tool-server tests run the server over stdio; left: the four 'world' tests assert what a recorded past run (item-va2 journal, session logs, prompts) holds, running no head code |
| `engine-cards-standin` | `standin.test.mjs` | moved | `test/regression/engine/standin-answer.test.mjs` | drives bin/host.js answer on items it records, against a local GitHub stand-in, and asserts refusals, journal rows and the merge |
| `engine-cards-standin` | `world.test.mjs` | left |  | asserts what a recorded past run (item sa-cards1 journal, GitHub's saved PR 28) holds, running no head code |
| `engine-effects` | `merge-at-sha.test.mjs` | left |  | asserts what saved merge results and journals of two past scratch runs (PRs 15, 17) hold, running no head code |
| `engine-effects` | `outside-merge.test.mjs` | split | `test/regression/engine/outside-merge.test.mjs` | moved: four tests run the journal check on GitHub's saved closed-PR list and a recorded host journal (input, now fixtures/outside-merge/); left: one test asserts what the saved GitHub list says |
| `engine-effects` | `red-ci.test.mjs` | split | `test/regression/engine/red-ci.test.mjs` | moved: three tests feed a saved check run and the delivered wake (input, now fixtures/red-ci/) through the wake parser into a host item; left: one test asserts what the saved REST answer says |
| `engine-host` | `forge.test.mjs` | split | `test/regression/engine/forged-wakes.test.mjs` | moved: six tests drive bin/host.js wake with forged hook input and assert nothing is read; left: the FINDING test pins an observed defect (a literal </event> in a GitHub field drops the event) rather than a contract, so it is not regression behaviour |
| `engine-host` | `host.test.mjs` | moved | `test/regression/engine/host.test.mjs` | drives the host's public functions on its own workflows (duplicate wakes, a child process killed mid-effect, stale completions, refused effects, replay); the crash-child helper is inlined as a script string |
| `engine-host` | `plugin-tools.test.mjs` | left |  | reads plugin.json, .mcp.json and the plugin scripts' source and matches text; the return tool server's one tool is asserted by running it in test/regression/run/accept.test.mjs |
| `engine-stage-contract` | `coverage.test.mjs` | moved | `test/regression/engine/verdict-covers.test.mjs` | drives accept() through the real hooks in the tourney world with missing, swapped and reworded lines and asserts refusal rows and the item state |
| `engine-stage-contract` | `stage-record.test.mjs` | split | `test/regression/engine/stage-record.test.mjs` | moved: runs the engine's tourney scenario tests and checks every stage.json they write reassembles to its brief.md, and shows the independent checker catches a broken record (stage-record.mjs, used by this file only, is inlined); left: one test asserts the recorded adopt-trial journal, running no head code |
| `engine-toy-run` | `toy-run.test.mjs` | left |  | asserts what the recorded toy run (item toy-v1 journal, transcripts, GitHub's saved PR 26) holds, running no head code; its two v1 journals are input to verify/harness-glossary's v1 reads and went to fixtures/v1/ |
| `fix-blocked-card-grant` | `grant.test.mjs` | moved | `test/regression/engine/standin-grants.test.mjs` | drives quick-fix with the real engine and stub agents to a card, answers it with bin/host.js answer under a grants file, and asserts the state and journal rows; merged with fix-grant-null-repo's test, which shares its helper, so the helper is inlined |
| `fix-blocked-retry` | `retry.test.mjs` | split | `test/regression/engine/blocked-retry.test.mjs` | moved: eight tests drive the real engine through blocked builds, retries, replans and drops and assert states, cards and errors (helper inlined); left: not-blocked-unchanged compared the head's scenario output with evidence/main-scenarios.json, a stored capture |
| `fix-finish-closes-waits` | `left-closes.test.mjs` | moved | `test/regression/engine/finish-closes-waits.test.mjs` | drives a quick-fix item through the real effect handlers over a recording thread and asserts closes, pending stops, open asks and journal rows; merged with its sibling so the suite helper is inlined |
| `fix-finish-closes-waits` | `nothing-else-held.test.mjs` | moved | `test/regression/engine/finish-closes-waits.test.mjs` | drives a quick-fix item through the real effect handlers over a recording thread and asserts closes, pending stops, open asks and journal rows; merged with its sibling so the suite helper is inlined |
| `fix-grant-null-repo` | `nullrepo.test.mjs` | moved | `test/regression/engine/standin-grants.test.mjs` | drives the same world to cards answered under grants listing null and asserts the refusal and an untouched item file; merged with fix-blocked-card-grant's test |
| `fix-other-host-runs-effects` | `two-hosts.test.mjs` | moved | `test/regression/engine/two-hosts.test.mjs` | drives two hosts of different sessions on one item and asserts no effect starts, the item file is untouched and the refusals land in the second session's file |
| `fix-rebuild-worktree` | `rebuild.test.mjs` | moved | `test/regression/engine/rebuild-on-branch.test.mjs` | drives rebuilds through the real engine against a local bare origin and stub GitHub and asserts the worktree branch, head, upstream, run.json and failures (helper inlined) |
| `fix-reminder-wake` | `reminder.test.mjs` | split | `test/regression/engine/reminder-wake.test.mjs` | moved: seven tests drive bin/host.js wake with ReadNotifications inputs and a shifted host clock and assert which timers fire (helper inlined; the clock preload became a data: URL); left: one test compared the helper's hook input with the JSON in a decision file, a doc-text check |
| `fix-verify-issue-echo` | `echo.test.mjs` | split | `test/regression/engine/verify-issue-echo.test.mjs` | moved: three tests drive accept() in the tourney world with trimmed, reordered and tampered issues and assert acceptance, refusal rows and state; left: prompt-agrees matched the rendered verify prompt and research.json against wording regexes, a text check on prompt words |
| `fix-waiting-wake` | `fires-holds.test.mjs` | moved | `test/regression/engine/waiting-wake.test.mjs` | drives an item past its checkBack due time and asserts the timer row, the held state and that a tap still moves it |
| `fix-waiting-wake` | `load-check.test.mjs` | split | `test/regression/engine/waiting-wake.test.mjs` | moved: the workflows load, and copies with an asking state's after removed or an unknown delay name are refused naming workflow and state; left: one test read the three workflow files and asserted which states ask and the delay value, pinning the files' content rather than what the load check does |
| `fix-waiting-wake` | `scheduled.test.mjs` | moved | `test/regression/engine/waiting-wake.test.mjs` | drives the three workflows into each asking state through the real handlers and asserts one wake asked for and dropped on leaving; merged with its two siblings so the suite helper is inlined |
| `parity-cases` | `C-duplicate-wake-no-double-effect.test.mjs` | moved | `test/regression/engine/duplicate-wake.test.mjs` | drives the real host (restore, offer, wakes) with stub agents through the case and asserts states, effects and journal rows |
| `parity-cases` | `C-red-ci-back-to-building.test.mjs` | moved | `test/regression/engine/red-ci-back-to-building.test.mjs` | drives the real host (restore, offer, wakes) with stub agents through the case and asserts states, effects and journal rows |
| `parity-cases` | `C-verdict-on-old-head.test.mjs` | moved | `test/regression/engine/verdict-on-old-head.test.mjs` | drives the real host (restore, offer, wakes) with stub agents through the case and asserts states, effects and journal rows |
| `prompt-catalogue` | `deps.test.mjs` | split | `test/regression/plan/runtime-deps.test.mjs` | moved: four tests run test/workspaces.test.mjs on scratch copies with dependencies and decision records changed and assert pass or fail; left: one test matched CLAUDE.md and docs/layout.md text |
| `prompt-catalogue` | `recorded.test.mjs` | moved | `test/regression/engine/catalogue-recorded.test.mjs` | drives a scripted run through the real bin/host.js and hook scripts and asserts each refusal row's entry and slots render to its reason; scenario.mjs, used by this file only once same-text left, is inlined |
| `prompt-catalogue` | `same-text.test.mjs` | left |  | compared the head's prompts and messages with base-scenario.json, base-direct.json and literals.mjs, captures of an earlier commit, and committed brief.md files with a fresh render |
| `prompt-catalogue` | `strict.test.mjs` | moved | `test/regression/engine/catalogue-strict.test.mjs` | calls the catalogue loader and renderer with malformed entries and values and asserts each refusal names the entry or line |
| `retire-pinned-legacy` | `one-check.test.mjs` | left |  | matched packages/engine/src text with regexes (no pinned option, the checkStages signature and its two call sites) |
| `retire-pinned-legacy` | `readable.test.mjs` | moved | `test/regression/engine/retired-pins.test.mjs` | loads every committed journal's pin through loadWorkflow and replays it through restore, asserting only the adopt trial's pin is retired; merged with retired.test.mjs, which shares its helper |
| `retire-pinned-legacy` | `retired.test.mjs` | moved | `test/regression/engine/retired-pins.test.mjs` | drives items on a retired pin through the real host functions and asserts they replay and are never advanced, and a start on a retired pin is refused |
| `run-lifecycle-store` | `answers.test.mjs` | split | `test/regression/run/lifecycle-store.test.mjs` | moved: the hooks are called in every state, attempts count every counted refusal, send-back and stall block, and each run fails at its cap, all read from the head's own run; left: the step-by-step comparison with evidence/main/trace.json and the two assertions against it |
| `run-lifecycle-store` | `budget.test.mjs` | split | `test/regression/run/lifecycle-store.test.mjs` | moved: BUDGET's values and the caps read from it, and a root with no attempts continuing from the journal's counts (its root now made at the head and stripped of attempts, not unpacked from evidence/main/pre.json); left: two tests and two assertions matched run-module source text for numbers and journal reads, and one comparison with the stored main trace |
| `run-lifecycle-store` | `owner.test.mjs` | left |  | matched engine and plugin source text with regexes (who names the lifecycle files, which function calls which) and compared actors.js's exports with evidence/main/exports.json |
| `run-lifecycle-store` | `states.test.mjs` | split | `test/regression/run/lifecycle-store.test.mjs` | moved: store.state over run folders now made by the scripted runs at the head (not evidence/main/states), store.state against an independent reading of every bench run folder (the toy-run folder list left with its evidence), and refused transitions writing nothing; the scenario helper is inlined |
| `run-names-one-module` | `installed-layout.test.mjs` | moved | `test/regression/run/run-names.test.mjs` | installs the plugin as setup.sh lays it out and runs the same steps, with a control that removes the bundled names.js |
| `run-names-one-module` | `node-only.test.mjs` | split | `test/regression/run/run-names.test.mjs` | moved: names.js imported from a copy of the engine source with no node_modules loads and answers, host.js there does not; left: one test matched names.js's import lines with a regex |
| `run-names-one-module` | `one-place.test.mjs` | left |  | searched engine and plugin source text for the run-id, safe and sorted-hash patterns with regexes |
| `run-names-one-module` | `return-answers.test.mjs` | moved | `test/regression/run/run-names.test.mjs` | drives the real return-tool server and PreToolUse hook with a reordered, a changed and an extended result and asserts the answers; merged with its siblings so lib.mjs and scenario.mjs are inlined |
| `stage-contract-declares-rules` | `checked.test.mjs` | moved | `test/regression/marks/declared-marks.test.mjs` | loads copies of the repo workflows with one wrong meta.marks declaration each and asserts each refusal names the stage and the path; merged with declared.test.mjs, which shares its helper |
| `stage-contract-declares-rules` | `declared.test.mjs` | moved | `test/regression/marks/declared-marks.test.mjs` | drives renamed and re-worded stages through the real loader and hooks in the tourney world and asserts what is stored, held to the lines and checked |
| `stage-contract-declares-rules` | `no-guessing.test.mjs` | left |  | matched engine source text with regexes (stage names, PASS and FAIL words, prRef calls, imports) |
| `stage-contract-declares-rules` | `same.test.mjs` | left |  | compared capture.mjs's output at the head with evidence/main.json, a stored capture of an earlier commit |
| `stage-prompt-files` | `base-fixture.test.mjs` | left |  | compared base-workflows/ with an earlier commit's workflows/, a stored capture |
| `stage-prompt-files` | `files.test.mjs` | left |  | compared the stage files' words with the base commit's JSON and merge-workflows/ captures, and read workflow and stage files for their sections and literals |
| `stage-prompt-files` | `load-check.test.mjs` | moved | `test/regression/engine/stage-files.test.mjs` | loads scratch copies of workflows/ with one malformed stage file each and asserts each refusal names the file and line; merged with pin.test.mjs, which shares its helper |
| `stage-prompt-files` | `pin.test.mjs` | split | `test/regression/engine/stage-files.test.mjs` | moved: a one-line stage-file edit changes the pinned id, and an item pinned before it loads, replays and renders from its blob alone; left: one test ran test/journals-replay.test.mjs as a child and counted its passes, which ci runs itself |
| `stage-prompt-files` | `same-prompt.test.mjs` | left |  | compared renders on the base commit's JSON with renders on the head's files, and committed brief.md files with a fresh render: captures of earlier output |
| `wf-intake` | `chart.test.mjs` | moved | `test/regression/engine/intake.test.mjs` | loads intake.json and drives every route through the real host with stub agents, asserting states, children and cards; merged with frozen and independent, which share its helper |
| `wf-intake` | `frozen.test.mjs` | moved | `test/regression/engine/intake.test.mjs` | drives intake to a child and asserts the challenge's issue is the child's start and brief input |
| `wf-intake` | `independent.test.mjs` | moved | `test/regression/engine/intake.test.mjs` | drives a revised challenge run and asserts its prepared prompt holds none of shape's other output, and accept() refuses bad challenge lines |
| `wf-intake` | `inspector.test.mjs` | moved | `test/regression/inspector/intake-bench-runs.test.mjs` | runs scripts/inspector/build.mjs over committed bench run folders (input under bench/) and asserts the page data holds each run's prompt and result |
| `wf-quick-fix` | `cases.test.mjs` | moved | `test/regression/engine/quick-fix-cases.test.mjs` | steps quick-fix.json's machine through the work-item cases with xstate and asserts states and guard outcomes |
| `wf-quick-fix` | `replays-110.test.mjs` | moved | `test/regression/engine/quick-fix-replay.test.mjs` | runs replay() on journals built from today's shapes and on the 110-demo package fixture, and asserts hashes, end state and refusals |
| `stage-bench` | `edit-safe.test.mjs` | split | `test/regression/engine/bench-prompts.test.mjs` | moved: with a brief rule edited, every committed journal replays on its pinned blob and renders its brief.md from the pin; left: the assertions that pinned the committed listing (at least 28 roots and 27 items, and exactly one unpinned journal under verify/engine-host) |
| `stage-bench` | `same-prompt.test.mjs` | split | `test/regression/engine/bench-prompts.test.mjs` | moved: bench --prompt-only on recorded inputs, the trial's pinned blob and every brief case equals the verifier's own render(); left: the comparison with the trial's committed brief.md files and the test that re-hashed and re-rendered every committed bench run folder, comparisons with stored output |

Other files, one row per suite:

| Suite | Files | What became of them |
|---|---|---|
| `engine-actor-returns` | 5 | `evidence/ar2-handback-tail.jsonl` (a real Claude Code transcript tail, input) moved to `test/regression/fixtures/handback-tail.jsonl`; the recorded journals and tails deleted |
| `engine-actors` | 11 | recorded run (item journal, session logs, prompts, worktree list) and a mutation log deleted |
| `engine-cards-standin` | 2 | recorded run (item journal, saved PR) deleted |
| `engine-effects` | 10 | `closed-prs.json` and `merge-control.journal.jsonl` moved to `test/regression/fixtures/outside-merge/`, `check-runs-pr18.json` and `delivered-wake-pr18.txt` moved to `test/regression/fixtures/red-ci/` (input); the merge-at-sha recordings, the mutation log and `world/` scripts that made them deleted |
| `engine-host` | 6 | `crash-child.mjs` inlined into `host.test.mjs` as a script string; `forge-probe.mjs` (not a test) and `one-owner-evidence/` (a recorded run) deleted |
| `engine-stage-contract` | 1 | `stage-record.mjs` inlined into `stage-record.test.mjs` |
| `engine-toy-run` | 8 | the two v1 journals moved to `test/regression/fixtures/v1/` (input to `verify/harness-glossary`'s v1 reads, whose path changed); the saved PR, card and transcripts deleted |
| `fix-blocked-card-grant` | 1 | `lib.mjs` inlined into `standin-grants.test.mjs` |
| `fix-blocked-retry` | 3 | `lib.mjs` inlined; `scenarios.mjs` and `evidence/main-scenarios.json` (a capture of main) deleted |
| `fix-finish-closes-waits` | 1 | `lib.mjs` inlined into `finish-closes-waits.test.mjs` |
| `fix-grant-null-repo` | 0 | none |
| `fix-other-host-runs-effects` | 0 | none |
| `fix-rebuild-worktree` | 1 | `lib.mjs` inlined into `rebuild-on-branch.test.mjs` |
| `fix-reminder-wake` | 2 | `lib.mjs` inlined into `reminder-wake.test.mjs`; `clock.mjs` became a `data:` URL preload there |
| `fix-verify-issue-echo` | 0 | none |
| `fix-waiting-wake` | 1 | `lib.mjs` inlined into `waiting-wake.test.mjs` |
| `parity-cases` | 2 | `lib.mjs` and `gaps-lib.mjs` became `test/regression/lib.mjs`, the one shared helper (four moved files use it); helpers only one file uses moved into that file |
| `prompt-catalogue` | 9 | `scenario.mjs` inlined into `catalogue-recorded.test.mjs`; `direct.mjs`, `literals.mjs`, `base-direct.json`, `base-scenario.json` (captures of an earlier commit) and `evidence/` deleted |
| `retire-pinned-legacy` | 3 | `lib.mjs` inlined into `retired-pins.test.mjs`; `evidence/` deleted |
| `run-lifecycle-store` | 71 | `scenario.mjs` inlined into `lifecycle-store.test.mjs`; `evidence/main/` (trace.json, pre.json, exports.json, states/: captures of main) and the two `.pass` listings deleted |
| `run-names-one-module` | 4 | `lib.mjs` and `scenario.mjs` inlined into `run-names.test.mjs`; two `.pass` listings deleted |
| `stage-bench` | 8 | `lib.mjs` inlined into `bench-prompts.test.mjs`; `evidence/` deleted |
| `stage-contract-declares-rules` | 3 | `lib.mjs` inlined into `declared-marks.test.mjs`; `capture.mjs` and `evidence/main.json` (a capture of main) deleted |
| `stage-prompt-files` | 18 | `lib.mjs` inlined into `stage-files.test.mjs` (its base-commit helpers dropped); `base-workflows/`, `merge-workflows/` (captures of earlier commits) and `evidence/` deleted |
| `wf-intake` | 7 | `lib.mjs` inlined into `intake.test.mjs`; `evidence/` deleted |
| `wf-quick-fix` | 0 | none |

## Done

Readied by replan #196 and built in PR #199. A separate session verified it at ad3d018: all eight Expect lines MET,
each verifier line naming its test under `verify/verify-regression-engine/` (the table, folder, moved-pass,
one-helper, bite, left-reasons and scope tests), `ci` from the PR's check runs. The 61 test files became 33 under
`test/regression/` (30 moved, 17 split, 14 left), 239 tests in about 36 seconds; the local suite fell from 399 s to
288 s. Main was merged into the verified branch once, for the new evidence gate step, and `ci` and `gates` were
green at that head. No engine, plugin or workflow code changed, so there is no release.

From the verifier's observations, for the later parts:

- `test/regression/fixtures/v1/` is read only by `verify/harness-glossary/lib.mjs`. When `verify-regression-plugin`
  retires that suite, the two v1 journals go with whatever of its tests moves, or are deleted if nothing moved reads
  them.
- `retired-pins` and `bench-prompts` scan every committed `*/items/*.jsonl`; a journal committed under `verify/`
  later would be read by them. The evidence policy keeps journals out of `verify/`, so this stays an observation.
- The per-suite quick-fix worlds inlined into each moved file are near-copies. Merging them into `lib.mjs` is design
  work for a later item, not part of a move.
- The engine-host FINDING test left because it pinned an open defect (a GitHub field holding a literal `</event>`
  drops that event). The defect is filed as the draft `fix-event-close-tag`.

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's moved tests first, write your own under `verify/verify-regression-engine/`:

- **table-complete:** list `verify/<suite>/*.test.mjs` for the 26 suites at the PR base with `git ls-tree`, parse the
  `## Regression table` at the head, compare the two sets, check each destination exists.
- **folders-hold-verdicts:** read the head tree of each of the 26 folders.
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
