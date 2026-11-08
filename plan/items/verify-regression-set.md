```json
{
  "id": "verify-regression-set",
  "title": "Retire the done suites into one regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Every done item's verify/ folder holds only verdict.json: the 30 folders the inputs name, and the folder of any item done by the PR's base. Every test file they held is either moved to test/regression/<area>/ or deleted with its evidence. A moved file goes to one of the eight areas of decision 4, mostly plan or gates, with the Expect id it proves in its first comment. A test is deleted when it read source text, compared a listing, compared a stored capture, only asserted a recorded past run, checked a retired path, or held an assertion a test outside verify/ already holds. A test that did both is split. Moved tests share test/regression/lib.mjs. The item's prose carries a table with one row per test file, its verdict and its reason. No engine, plugin, workflow or script source changes.",
  "why": "Last of three parts of verify-regression-set, split by suite (plan/decisions/2026-11-08-verify-regression-split.md); same rule as verify-regression-engine and verify-regression-plugin (L-measure-then-park; decision 4 of plan/decisions/2026-11-08-verification-swing.md). It closes the series: after it, only the item being verified has tests under verify/.",
  "serves": [
    "L-contract-names-behaviour",
    "L-measure-then-park",
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-regression-engine",
    "verify-regression-plugin",
    "test-fixture-edges",
    "scope-suite-own-pr",
    "pinned-fetch-temp-repo"
  ],
  "inputs": [
    {
      "ref": "plan/research/verification-swing.md",
      "what": "Read this first; How to classify a verifier test"
    },
    {
      "ref": "plan/decisions/2026-11-08-verification-swing.md, plan/decisions/2026-11-08-verify-regression-split.md",
      "what": "Decision 4 (done suites retire), and the split: the folder-per-area layout, the Expect header, the one helper, fixtures, a reader in another folder follows the move (6), a timing bar held elsewhere leaves (7)"
    },
    {
      "ref": "verify/clean-room-install-test, verify/comments-present-tense, verify/done-with-the-build, verify/effort-scope-own-pr, verify/env-bootstrap, verify/evidence-gate-edges, verify/first-real-issue, verify/fix-budget-rule, verify/fix-event-close-tag, verify/fix-trace-writes-clone-cwd, verify/item-head-trim, verify/map-once-traps-written, verify/plan-reader-effort, verify/probe-plugin-agents, verify/probe-plugin-agents-thread, verify/refine-brief-stage, verify/retro-first-item, verify/rules-said-once, verify/scope-suite-own-pr, verify/self-edit-check-snapshot, verify/self-update-by-version, verify/test-fixture-edges, verify/tournament-kit, verify/tournament-scoring-floors, verify/trial-fail-path, verify/verdict-cutoff-at-verified-sha, verify/verification-contract, verify/verify-evidence-policy, verify/verify-regression-engine, verify/verify-regression-plugin",
      "what": "The 30 done folders that hold tests on 8 Nov: their tests, helpers, evidence and verdicts, and the Expect lines of the items that wrote them; with any item done by the PR's base, the suites this item retires"
    },
    {
      "ref": "plan/items/verify-regression-engine.md, plan/items/verify-regression-plugin.md",
      "what": "The earlier parts' Regression tables, Done notes and contract change: how rows were judged, and what CI taught (no Playwright there, the moved files run side by side)"
    },
    {
      "ref": "docs/language.md",
      "what": "The area names and the words for each test's header"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression/<area>/: plan/ and gates/ for most, and any other of the eight areas where a test fits it better",
      "what": "The moved tests as *.test.mjs files named for the behaviour they cover (the test files of one suite may merge into one file, so its helper is inlined rather than shared); each opens with a comment `Expect: <item>/<expect-id>` for every Expect line it proves"
    },
    {
      "ref": "test/regression/lib.mjs",
      "what": "The one helper: only what two or more moved test files use; a helper one file uses is inlined into it"
    },
    {
      "ref": "test/regression/fixtures/",
      "what": "Data a moved test reads as input, never a stored capture of the harness's own output to compare with; test/regression/fixtures/agent-transcript.jsonl stays, and verify/probe-plugin-agents-thread/evidence/agent-adda18087b10e0b3a.jsonl, of which it is a copy, is deleted"
    },
    {
      "ref": "verify/<each retired folder>/",
      "what": "verdict.json only; tests, helpers, evidence, .pass listings and captures deleted"
    },
    {
      "ref": "plan/items/verify-regression-set.md",
      "what": "A `## Regression table` section: one row per test file of the retired folders (path, moved to <path> / split / left, one reason), and one row per folder for its other files (helpers and evidence, and where any went)"
    }
  ],
  "expect": [
    {
      "id": "table-complete",
      "check": "The item file's Regression table has exactly one row for every *.test.mjs or *.test.js file that every done item's verify/ folder at the PR's base other than this item's held, and no row for any other test file; each row's verdict is moved, split or left with a non-empty reason; every test-file path the table names as a destination exists at the head under test/regression/<area>/ for one of the eight areas of decision 4 (engine, run, marks, journal, plugin, inspector, plan, gates)",
      "how": "The verifier's own test listing the base's verify/ folders with git, reading each item's status at the base, and parsing the table at the head",
      "proof": "verifier"
    },
    {
      "id": "folders-hold-verdicts",
      "check": "At the head, every done item's verify/ folder at the PR's base other than this item's holds verdict.json and no other file, and each verdict.json parses with its item field equal to the folder name; no folder under verify/ holds a test file except this item's and those of items not done at the head",
      "how": "The verifier's own test reading the head's tree and each item's status",
      "proof": "verifier"
    },
    {
      "id": "moved-pass",
      "check": "node --test over every test file under test/regression/ passes at the head with at least one passing test per file, also with Playwright out of reach and with every file run at once; every such file's first comment names at least one Expect line as <item>/<expect-id> where the item exists in plan/items/ and has that Expect id; no file under test/regression/ reads a path under verify/",
      "how": "The verifier's own test running node --test on each file from a child process, in parallel, with and without Playwright resolvable, and reading each file's header against the plan",
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
      "check": "For each of plan/ and gates/ that holds a moved test, and one other area this PR adds tests to if any, the verifier picks one, breaks the behaviour it asserts in a scratch copy of the head (the plan check's answer, a gate's refusal, a script's output), and that test file goes red; restored, it is green",
      "how": "The verifier's own test copying the head to a temp folder, editing the source under plan/, scripts/, plugins/ or packages/ and running node --test",
      "proof": "verifier"
    },
    {
      "id": "left-reasons-hold",
      "check": "For every row marked left, and every left half of a split row, the deleted test read a source or doc file and matched text, compared a .pass or reporter listing, compared output with a capture stored under verify/, asserted facts of a recorded past run (a journal, transcript or GitHub response under verify/) without running the head's code on it, checked a retired path, or held the same assertion on the same code as a test outside verify/ that npm test runs, which the row names, and could not hold it under the regression set's parallel runs; the verifier records any row it disagrees with in observations and fails this line only if a left test drove the engine, a hook, a gate, a script or the plan check and asserted on what came back without comparing it to a stored capture",
      "how": "The verifier reads each left test at the PR's base and writes a test that asserts its sample rows against the base files",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR adds, changes or deletes files only under test/regression/, under the retired verify/ folders, and plan/items/verify-regression-set.md, except that a test or helper in a verify/ folder of an item not yet done that read a file this PR moved or deleted changes only so it reads the new path or no longer reads that file, and that docs/traps.md, where it names a test file this PR deletes as an example, changes only to drop that example; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes",
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
      "the per-suite helpers of the retired suites into test/regression/lib.mjs"
    ],
    "removes": [
      "stored captures of earlier output as a test oracle, for every done item"
    ],
    "budget": 1
  },
  "non_goals": [
    "No engine, plugin, workflow, script or bench change, so no release",
    "No new test of behaviour the suites did not already test; a split test keeps only what it asserted",
    "No re-capture of a deleted capture under a new name",
    "No gate or rule that retires a future item's suite when it is done: that is a later item if the set needs it",
    "The verify model stage and workflows/quick-fix/verify.md are untouched",
    "Retiring the inferred marks reading or the brief.md fallback is retire-unmarked-reading and retire-brief-file-fallback"
  ],
  "records": [
    "The Regression table in the item file and the PR body",
    "The local suite time before and after, in the PR body, as information"
  ],
  "person_prereqs": [],
  "contract_changes": 1,
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 4000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "More items finish while this builds; their folders join the scope at the PR's base, so the build merges main and adds their rows before the verdict",
    "Several suites read git history beyond a depth-1 checkout (fix-budget-rule's backfill, the scope suites); a moved test that needs history must build its own temp repo, as pinned-fetch-temp-repo does, or it leaves as a fact of a recorded past",
    "verify-regression-engine and verify-regression-plugin's suites check test/regression/ itself (moved-pass, one-helper); they read the earlier parts' tables and leave, and this item's verifier writes its own",
    "CI has no Playwright and runs moved files side by side: a moved file needs one test that runs without a browser, its own temp paths, and no wall-clock bar"
  ],
  "done_on": "2026-11-08"
}
```

## What this is

The last of three parts of `verify-regression-set` (`plan/decisions/2026-11-08-verify-regression-split.md`). It takes
every done item's suite that still holds tests: the 19 named at the split, the items done since (from
`verify-evidence-policy` to `done-with-the-build`), and the first two parts' own verifier suites. It runs with the rule,
Expect lines and Verifier brief of `verify-regression-plugin`, changed for the folders, the areas and the scope line.

Read a test, not its name (research, "How to classify a verifier test"). It **moves** when it calls the plan check, a
gate, a script, the engine, the host, a hook or a page's reader on a copy or temp root and asserts on what came back or
what was written. It **leaves** when it reads a source or doc file and matches a regex, compares a `.pass` or reporter
listing, compares with a stored capture, only asserts facts of a recorded past run, checks a retired path, or holds an
assertion a test outside `verify/` already holds and cannot hold it in parallel (decision 7). A test that does both is
split. A test that reads committed data as *input* moves, and its input goes to `test/regression/fixtures/`.

Known now:

- `rules-said-once` already deleted `repo-skeleton/claude-md.test.mjs`, `verification-contract/rules-written.test.mjs`
  and `fix-budget-rule/rule-written.test.mjs`; they have no row.
- Known moves: `fix-budget-rule`'s `budget-refuses` and `names-module`. Known leaves: `comments-present-tense`'s
  regex tests over READMEs and source, every `.pass` listing, each scope test that reads its own PR's file list.
- Folders with no tests (`first-real-issue`, `probe-plugin-agents-thread`) keep their verdict and lose their evidence;
  the transcript `verify-regression-plugin` copied to `test/regression/fixtures/agent-transcript.jsonl` is deleted
  from `probe-plugin-agents-thread/evidence/`.
- What CI taught the earlier parts: it has no Playwright, and the moved-pass suites ran every file at once. Once this
  item retires those two suites the second load is gone, but a moved file still needs its own temp paths and a test
  that runs without a browser.
- An item done after this item is readied but before its build merges joins the scope at the PR's base; the build
  adds its rows after merging main, and the verifier reads the folder list from the base.

Report the local suite time before and after in the PR, as information; dropping the two moved-pass suites and every
evidence-comparing test should cut it.

## Contract change

The scope line allowed no change outside `test/regression/`, the retired folders and the item file, except a reader in
a not-done item's folder. But `docs/traps.md` names two of the retired test files as examples:
`verify/item-head-trim/scope.test.mjs` for fetching pinned commits into a temp bare repo, and
`verify/rules-said-once/suite-and-scope.test.mjs` for a scope test that reads git only on its own PR. Both leave as
scope tests of their own PRs, and `test/docs.test.mjs` fails when a path `docs/traps.md` names does not exist. No
test that stays does either thing, so there is nothing to re-point to. The scope line and the Verifier brief's scope
bullet now also allow `docs/traps.md` to drop those example names and nothing else. The traps themselves are
unchanged. No other line moves.

## Regression table

One row per test file the 33 done folders held at the base, then one row per folder for its other files. `moved` and
`split` name the file under `test/regression/` that holds the moved tests.

| Test file | Verdict | Moved to | Reason |
|---|---|---|---|
| `verify/clean-room-install-test/clean-room.test.mjs` | moved | `test/regression/plugin/clean-room.test.mjs` | runs the clean room on a temp repo of the head's tree, whole and with a plugin file deleted, and asserts its steps and self-check line |
| `verify/comments-present-tense/readme.test.mjs` | left |  | matched packages/engine's README, src/index.js and bin/host.js text with regexes |
| `verify/comments-present-tense/strip.test.mjs` | left |  | tested the verifier's own comment scanner, strip.mjs in the same folder, not harness code |
| `verify/done-with-the-build/build-sets-done.test.mjs` | moved | `test/regression/gates/build-sets-done.test.mjs` | runs the freeze and verdict gates and the plan check in a temp repo on a build whose first commit sets its item done |
| `verify/done-with-the-build/effort-by-item.test.mjs` | moved | `test/regression/gates/build-sets-done.test.mjs` | runs reader-effort.mjs --item in a temp repo of three merged PRs and on an item with no verdict |
| `verify/done-with-the-build/scope.test.mjs` | left |  | read its own PR's file list between two pinned commits |
| `verify/done-with-the-build/tests-bite.test.mjs` | moved | `test/regression/gates/build-sets-done.test.mjs` | runs the gate and reader-effort tests on a temp copy of scripts/ with contract() and --item broken, red each time, green restored |
| `verify/effort-scope-own-pr/full-clone-passes.test.mjs` | left |  | ran verify/plan-reader-effort/plan-and-suite-pass.test.mjs, which this PR deletes, at pinned commits: a retired path |
| `verify/effort-scope-own-pr/own-pr-reads-git.test.mjs` | left |  | ran verify/plan-reader-effort/plan-and-suite-pass.test.mjs, which this PR deletes, at pinned commits of #212: a retired path |
| `verify/effort-scope-own-pr/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/env-bootstrap/setup.test.mjs` | moved | `test/regression/plugin/setup-install.test.mjs` | runs setup.sh twice in an empty HOME, edits the working tree after an install, and runs the SessionStart hook with no install marker |
| `verify/evidence-gate-edges/link-refused.test.mjs` | moved | `test/regression/gates/evidence-links-listings.test.mjs` | runs the evidence gate in a temp repo on symlinks, a submodule and a regular file and asserts refusals and the pass |
| `verify/evidence-gate-edges/listing-refused.test.mjs` | moved | `test/regression/gates/evidence-links-listings.test.mjs` | runs the evidence gate in a temp repo on listings made at run time, an excerpt, a large file, a .pass file and a deletion |
| `verify/evidence-gate-edges/plan-passes.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list |
| `verify/evidence-gate-edges/rules-written.test.mjs` | left |  | matched docs/gates.md, plan/README.md and docs/language.md text with regexes and counted their lines (the line budget is held by test/docs.test.mjs) |
| `verify/evidence-gate-edges/tests-bite.test.mjs` | moved | `test/regression/gates/evidence-links-listings.test.mjs` | runs the gate tests on a temp copy of scripts/ with the mode and listing rules broken, red each time, green restored |
| `verify/fix-budget-rule/backfill-true.test.mjs` | left |  | asserted what the repo's plan files and their git history hold (each done fix's module and first done date), running no plan check or script |
| `verify/fix-budget-rule/budget-refuses.test.mjs` | moved | `test/regression/plan/fix-budget.test.mjs` | runs the plan check on temp plan copies with done fixes inside and outside the 14 days and design items before and after them |
| `verify/fix-budget-rule/names-module.test.mjs` | moved | `test/regression/plan/fix-budget.test.mjs` | runs the plan check on temp plan copies with a missing module, a made module and done items with and without done_on |
| `verify/fix-event-close-tag/close-tag-kept.test.mjs` | moved | `test/regression/engine/event-close-tag.test.mjs` | drives bin/host.js wake with a check run whose title holds a literal close tag and asserts the one transition it makes |
| `verify/fix-event-close-tag/forged-markup.test.mjs` | moved | `test/regression/engine/event-close-tag.test.mjs` | feeds wakes with markup in every string field through inputsOfWake and a restored item and asserts one event each |
| `verify/fix-event-close-tag/real-wakes.test.mjs` | moved | `test/regression/engine/event-close-tag.test.mjs` | reads every recorded platform wake under packages/engine/test/fixtures/ and fixtures/red-ci/ with inputsOfWake and fires a due timer from a one-line wake |
| `verify/fix-event-close-tag/unreadable.test.mjs` | moved | `test/regression/engine/event-close-tag.test.mjs` | drives bin/host.js wake with an event the parser cannot read and asserts the journalled row and that nothing transitions |
| `verify/fix-trace-writes-clone-cwd/child-after-return.test.mjs` | split | `test/regression/plugin/trace-writes-clone.test.mjs` | moved: feeds synthetic traces to the head's writesUnder and asserts the child's and the unknown pid's paths; left: the base test ran the base commit's writesUnder, fetched by sha |
| `verify/fix-trace-writes-clone-cwd/child-before-return.test.mjs` | split | `test/regression/plugin/trace-writes-clone.test.mjs` | moved: feeds synthetic traces to the head's writesUnder and asserts the child's paths; left: the base test ran the base commit's writesUnder, fetched by sha, which asserts what an earlier commit did |
| `verify/fix-trace-writes-clone-cwd/scope.test.mjs` | left |  | read its own PR's file list between two pinned commits |
| `verify/fresh-reader-gaps/budget.test.mjs` | left |  | matched BUDGET in test/docs.test.mjs with a regex and ran test/docs.test.mjs, which npm test runs itself |
| `verify/fresh-reader-gaps/fresh-reader-path.test.mjs` | left |  | graded a recorded fresh session's answer under verify/ and matched the cited files' text with regexes |
| `verify/fresh-reader-gaps/one-suite-command.test.mjs` | left |  | matched CLAUDE.md's Commands text and ran node --test on verify/item-head-trim/, a folder this PR empties: a retired path, and node's behaviour rather than the harness's |
| `verify/fresh-reader-gaps/release-paths-named-once.test.mjs` | left |  | matched docs/gates.md, plan/README.md and release.mjs text with regexes |
| `verify/fresh-reader-gaps/suite-and-scope.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list, and one test read its own item's status |
| `verify/item-head-trim/done-heads-pass.test.mjs` | moved | `test/regression/plan/lean-ready-head.test.mjs` | runs the plan check on the repo's plan and on temp copies with step_back rounds changed |
| `verify/item-head-trim/lean-ready-passes.test.mjs` | moved | `test/regression/plan/lean-ready-head.test.mjs` | runs the plan check on temp plan copies with a lean ready head and with required fields emptied |
| `verify/item-head-trim/scope.test.mjs` | left |  | read its own PR's file list between two pinned commits |
| `verify/item-head-trim/tests-bite.test.mjs` | moved | `test/regression/plan/lean-ready-head.test.mjs` | runs test/plan-check.test.mjs on a temp copy with verifier back in readyRequired, red, green restored |
| `verify/map-once-traps-written/map-complete.test.mjs` | split | `test/regression/plan/layout-map.test.mjs` | moved: runs test/docs.test.mjs on a temp copy with a new scripts/x folder and asserts it fails naming it; left: two tests matched CLAUDE.md and docs/layout.md text with regexes, and one ran test/docs.test.mjs at the checkout, which npm test runs itself |
| `verify/map-once-traps-written/suite-and-scope.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list between pinned commits, and two tests matched verdict.yml and its own item head with regexes |
| `verify/map-once-traps-written/tests-bite.test.mjs` | moved | `test/regression/plan/layout-map.test.mjs` | runs test/docs.test.mjs on temp copies with the scripts/gates/ entry and the scripts/ row taken out, red each time, green restored |
| `verify/pinned-fetch-temp-repo/no-checkout-fetch.test.mjs` | left |  | ran four verifier suites under verify/ (fix-trace-writes-clone-cwd, test-fixture-edges, map-once-traps-written, verify-regression-engine), which this PR deletes, in a depth-1 clone: a retired path |
| `verify/pinned-fetch-temp-repo/parallel-green.test.mjs` | left |  | ran the same four verifier suites, which this PR deletes, twelve at once: a retired path |
| `verify/pinned-fetch-temp-repo/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/pinned-fetch-temp-repo/trap-written.test.mjs` | left |  | matched docs/traps.md text with regexes |
| `verify/plan-reader-effort/categories.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs reader-effort.mjs on a temp branch with one file of each category and asserts the split and the PR lookup |
| `verify/plan-reader-effort/exports.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs reader-effort.mjs on temp branches adding and removing exports in code, test and verifier files |
| `verify/plan-reader-effort/not-a-contract-change.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs the freeze gate in a temp repo on PRs adding reader_effort, with and without an Expect change, and with contract() mutated |
| `verify/plan-reader-effort/plan-and-suite-pass.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list |
| `verify/plan-reader-effort/plan-rule.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs the plan check on temp plan copies with well-formed and malformed reader_effort |
| `verify/plan-reader-effort/reader-lines.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs reader-effort.mjs on temp branches calling unchanged, unknown and new definitions and asserts reader_lines |
| `verify/plan-reader-effort/rules-written.test.mjs` | left |  | matched docs/gates.md and docs/language.md text with regexes |
| `verify/plan-reader-effort/tests-bite.test.mjs` | moved | `test/regression/gates/reader-effort.test.mjs` | runs scripts/reader-effort.test.mjs on a temp copy with category() broken, red, green restored |
| `verify/probe-plugin-agents/evidence.test.mjs` | left |  | asserted what the probe's recorded install and agent transcripts under verify/ hold, running no head code |
| `verify/refine-brief-stage/cases.test.mjs` | split | `test/regression/engine/brief-bench.test.mjs` | moved: the new cases' issues checked against intake's schema with the engine's check(), and their traps run in seed repos made by the bench's caseRepo(); left: the baseline-run count read a folder listing, and three tests compared case and run files with main-fixtures.json, a stored capture of main |
| `verify/refine-brief-stage/real.test.mjs` | split | `test/regression/engine/brief-bench.test.mjs` | moved: the bench's oneCheckPerLine and builderCriteria on the recorded real briefs (input, now fixtures/brief-bench/); left: two tests asserted what the recorded runs hold, and one ran the briefs' commands in the seed repo, which tests the seed repo and not the harness |
| `verify/refine-brief-stage/rubric.test.mjs` | split | `test/regression/engine/brief-bench.test.mjs` | moved: builderCriteria on the planted briefs (input, now fixtures/brief-bench/) and on escaped and paraphrased lines, and the baseline set rescored with score.mjs --no-judge to its totals; left: two tests asserted what rubric.json and the judge-check folder hold |
| `verify/refine-brief-stage/variants.test.mjs` | split | `test/regression/engine/brief-bench.test.mjs` | moved: each committed run set rescored with score.mjs --no-judge to the decision's table; left: compare.mjs output compared with the committed reports, the pinned stage files compared with main-fixtures.json and with each other, and the blind-read packets compared with committed ones, all stored captures |
| `verify/retire-doing/doing-refused.test.mjs` | moved | `test/regression/plan/no-doing-status.test.mjs` | runs the plan check on a temp plan copy with an item at doing, ready and done |
| `verify/retire-doing/ready-rules.test.mjs` | moved | `test/regression/plan/no-doing-status.test.mjs` | runs the plan check on temp plan copies and the freeze gate in a temp repo on the ready rules and asserts refusals and passes |
| `verify/retire-doing/scope.test.mjs` | left |  | read its own PR's file list between two pinned commits |
| `verify/retire-doing/tests-bite.test.mjs` | moved | `test/regression/plan/no-doing-status.test.mjs` | runs test/plan-check.test.mjs on a temp copy with doing back in the schema, red, green restored |
| `verify/retire-doing/texts-name-the-path.test.mjs` | left |  | matched plan/README.md, docs, CLAUDE.md and gate source text with regexes |
| `verify/retro-first-item/retro.test.mjs` | left |  | asserted what a recorded session transcript and item journal under verify/ hold against the retro's table, running no head code |
| `verify/rule-text-tests/fresh-verifier-follows.test.mjs` | left |  | ran a recorded fresh session's tests, saved under verify/, against plan/README.md and rewordings of it: asserts what that session wrote, over doc text |
| `verify/rule-text-tests/rule-written.test.mjs` | left |  | matched docs/layout.md text with regexes |
| `verify/rule-text-tests/suite-and-scope.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list, and one test read its own item's status |
| `verify/rules-said-once/fresh-reader-path.test.mjs` | moved | `test/regression/gates/item-line.test.mjs` | runs the freeze and verdict gates in a temp repo on the replan and build PRs a fresh reader described and asserts passes and the one refusal |
| `verify/rules-said-once/item-line-names.test.mjs` | moved | `test/regression/gates/item-line.test.mjs` | runs the verdict gate in a temp repo with and without an Item line, on replan and build branches and with an unknown id |
| `verify/rules-said-once/suite-and-scope.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list |
| `verify/rules-said-once/tests-bite.test.mjs` | moved | `test/regression/gates/item-line.test.mjs` | runs test/docs.test.mjs and the gate tests on temp copies with a named path renamed, the budget reached and namedItem broken, red each time, green restored |
| `verify/rules-said-once/texts-hold-paths.test.mjs` | left |  | read CLAUDE.md, plan/README.md and docs/ text, matched backticked paths with regexes and counted lines (the CLAUDE.md paths and the line budget are held by test/docs.test.mjs) |
| `verify/scope-suite-own-pr/full-clone-passes.test.mjs` | left |  | ran verify/rules-said-once/suite-and-scope.test.mjs, which this PR deletes, at pinned commits: a retired path |
| `verify/scope-suite-own-pr/own-pr-reads-git.test.mjs` | left |  | ran verify/rules-said-once/suite-and-scope.test.mjs, which this PR deletes, at pinned commits of #202: a retired path |
| `verify/scope-suite-own-pr/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/self-edit-check-snapshot/env-inherited.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | runs the no-self-edit suite with a recording bash and node preload and asserts the environment each setup.sh, hook and release.mjs run receives |
| `verify/self-edit-check-snapshot/runs-without-strace.test.mjs` | split | `test/regression/plugin/self-edit-check.test.mjs` | moved: runs the no-self-edit suite with strace off PATH and asserts six passes, none skipped; left: one test matched every test file's text for the tool's name with a regex |
| `verify/self-edit-check-snapshot/snapshot-detects.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | runs the no-self-edit file's snap() and changed() on a temp folder through eight kinds of write and a read-only run |
| `verify/self-edit-check-snapshot/strace-kept.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | runs scripts/debug/trace-writes.mjs on a command writing inside and outside a folder, with --keep, and with strace off PATH |
| `verify/self-edit-check-snapshot/tags-dropped.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | runs test/setup.test.mjs in clones with newer release refs and with none, and with its drop of inherited refs taken out, red |
| `verify/self-edit-check-snapshot/temp-removed.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | runs the no-self-edit suite and test/setup.test.mjs, passing and made to fail, in a fresh TMPDIR and asserts nothing is left |
| `verify/self-edit-check-snapshot/tests-bite.test.mjs` | moved | `test/regression/plugin/self-edit-check.test.mjs` | breaks setup.sh, the notice hook and release.mjs in clones so each writes under the plugin root and asserts the no-self-edit tests guarding it go red |
| `verify/self-update-by-version/no-self-edit.test.mjs` | moved | `test/regression/plugin/no-self-edit.test.mjs` | runs setup.sh, the notice hook and release.mjs beside a live and a foreign Claude and snapshots the plugin root before and after |
| `verify/test-fixture-edges/detached-release-clone.test.mjs` | split | `test/regression/plugin/release-clone-and-keep.test.mjs` | moved: runs copy-not-link and no-self-edit in a clone detached at a commit only a release branch points at; left: the other test applied a stored reverse diff of the build (to-base.diff) and ran that earlier code |
| `verify/test-fixture-edges/keep-across-fs.test.mjs` | split | `test/regression/plugin/release-clone-and-keep.test.mjs` | moved: runs trace-writes.mjs --keep on the same and another file system with the real and a stand-in strace; left: the other test applied the stored reverse diff of the build and ran that earlier code |
| `verify/test-fixture-edges/p95-over-bare.test.mjs` | left |  | timed process starts against wall-clock bars, which cannot hold under the regression set's parallel runs; the p95-over-bare bar is held by plugins/harness/test/capture.test.mjs's cheap test, which npm test runs (decision 7), and one test ran the build's change reverted from a stored diff |
| `verify/test-fixture-edges/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/tournament-kit/generic.test.mjs` | split | `test/regression/plan/tournament-kit.test.mjs` | moved: args.mjs builds valid args from the toy folder, and the toy tournament runs through the runner with stub agents to a result; left: two tests matched scripts/tournament source text with regexes |
| `verify/tournament-kit/index.test.mjs` | left |  | matched tournaments/README.md and docs/tournaments.md text with regexes |
| `verify/tournament-kit/pinned.test.mjs` | moved | `test/regression/plan/tournament-kit.test.mjs` | runs args.mjs on every tournaments/ folder and on toy copies each missing one pinned field, and asserts passes and refusals |
| `verify/tournament-scoring-floors/args.test.mjs` | moved | `test/regression/plan/tournament-kit.test.mjs` | runs args.mjs on a real and a toy folder with scoring fields removed and asserts the refusals |
| `verify/tournament-scoring-floors/rescore.test.mjs` | split | `test/regression/plan/tournament-kit.test.mjs` | moved: runs score.mjs on the stage-contract tournament with its recorded judge and measure files (input, now fixtures/tournament/rescore/) and asserts who qualifies and the trade-off table; left: one test compared those measure files with the folder's own scores.json, a fixture check |
| `verify/tournament-scoring-floors/toy.test.mjs` | moved | `test/regression/plan/tournament-kit.test.mjs` | runs score.mjs on the toy tournament with floors failed, left out and judged, and asserts qualification, the counting rule and ranking |
| `verify/trial-fail-path/trials.test.mjs` | split | `test/regression/engine/trial-replay.test.mjs` | moved: the fail and blocked journals replay through restore() on their pinned quick-fix and end done and at replanning; left: the real-agents, refusals-counted and stage-record tests compared the recorded prompts, refusal rows and brief.md files with each other and with report.md, and re-ran the trial driver to compare its first prompt with the committed one, a stored capture |
| `verify/verdict-cutoff-at-verified-sha/cutoff-refused.test.mjs` | moved | `test/regression/gates/verdict-cutoff.test.mjs` | runs the verdict gate in a temp repo after side branches merge into a verified build and asserts refusals and passes |
| `verify/verdict-cutoff-at-verified-sha/done-on-held.test.mjs` | moved | `test/regression/gates/verdict-cutoff.test.mjs` | runs the freeze gate in a temp repo on moved, removed and newly set done_on dates and asserts refusals and passes |
| `verify/verdict-cutoff-at-verified-sha/plan-passes.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list |
| `verify/verdict-cutoff-at-verified-sha/rules-written.test.mjs` | left |  | matched docs/gates.md and docs/language.md text with regexes |
| `verify/verdict-cutoff-at-verified-sha/tests-bite.test.mjs` | moved | `test/regression/gates/verdict-cutoff.test.mjs` | runs the gate tests on a temp copy of scripts/ with the cutoff and done_on rules broken, red each time, green restored |
| `verify/verification-contract/behaviour-lines.test.mjs` | moved | `test/regression/gates/contract-and-verdict-tests.test.mjs` | runs the plan check on temp plan copies with each listed phrase and a sha in ready, draft and done checks and asserts refusals and passes |
| `verify/verification-contract/contract-change-once.test.mjs` | moved | `test/regression/gates/contract-and-verdict-tests.test.mjs` | runs the freeze gate and the plan check in a temp repo on contract changes with and without the label, the count and the section |
| `verify/verification-contract/plan-and-suite-pass.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the second test read the plan files' Expect text with regexes and asserted what they say |
| `verify/verification-contract/tests-bite.test.mjs` | moved | `test/regression/gates/contract-and-verdict-tests.test.mjs` | runs the plan-check and gate tests on a temp copy with the deny-list emptied and the test rule dropped, red each time, green restored |
| `verify/verification-contract/verdict-runs-tests.test.mjs` | moved | `test/regression/gates/contract-and-verdict-tests.test.mjs` | runs the verdict gate in a temp repo on verdicts naming passing, failing, crashing, missing and stray tests |
| `verify/verifier-reader-gaps/done-on-when-module.test.mjs` | split | `test/regression/gates/local-verdict-run.test.mjs` | moved: runs the plan check on a temp plan copy with done items with and without module and done_on; left: one test matched plan/README.md step 2 with regexes |
| `verify/verifier-reader-gaps/fresh-verifier.test.mjs` | left |  | graded a recorded fresh session's answer under verify/ and matched docs/gates.md text with regexes |
| `verify/verifier-reader-gaps/local-gate-run.test.mjs` | split | `test/regression/gates/local-verdict-run.test.mjs` | moved: runs the command docs/gates.md gives in a shell on a temp build branch, with and without PR_BODY; left: one test matched that command's text with regexes |
| `verify/verifier-reader-gaps/suite-and-scope.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list, and the step-2 tests ran fresh-reader-gaps' suite under verify/, which this PR deletes, over plan/README.md text |
| `verify/verifier-reader-gaps/world-needs-no-test.test.mjs` | split | `test/regression/gates/local-verdict-run.test.mjs` | moved: runs the verdict gate in a temp repo on a world result with no test, complete and not; left: one test matched docs/gates.md text with regexes |
| `verify/verify-evidence-policy/evidence-refused.test.mjs` | moved | `test/regression/gates/evidence-size.test.mjs` | runs the evidence gate in a temp repo on added, grown, renamed and deleted files and asserts refusals and passes |
| `verify/verify-evidence-policy/gate-wired.test.mjs` | left |  | one test matched verdict.yml text with regexes; the other ran the evidence gate on the item's own verify/ folder, its recorded evidence, which this PR deletes |
| `verify/verify-evidence-policy/plan-passes.test.mjs` | split | `test/regression/plan/real-plan.test.mjs` | moved: runs the plan check on the repo's plan; left: the scope test read its own PR's file list |
| `verify/verify-evidence-policy/policy-written.test.mjs` | left |  | matched docs/gates.md and docs/language.md text with regexes |
| `verify/verify-evidence-policy/tests-bite.test.mjs` | moved | `test/regression/gates/evidence-size.test.mjs` | runs the gate tests on a temp copy of scripts/ with the size and .pass rules broken, red each time, green restored |
| `verify/verify-regression-engine/bite.test.mjs` | moved | `test/regression/engine/moved-tests-bite.test.mjs` | breaks the workflow, the run store and the marks check in a scratch copy of the head and runs the moved engine, run and marks tests, red each time, green restored |
| `verify/verify-regression-engine/folders.test.mjs` | left |  | compared a listing of the part's verify/ folders with verdict.json alone |
| `verify/verify-regression-engine/left-reasons.test.mjs` | left |  | read the base's left test files and matched their text with regexes |
| `verify/verify-regression-engine/moved-pass.test.mjs` | left |  | ran every file under test/regression/ at once and read their headers against that part's table: the whole set is run by npm test itself, and this second concurrent load is what broke the timing bars (decision 7) |
| `verify/verify-regression-engine/one-helper.test.mjs` | left |  | read test/regression/ source text and matched its import lines with regexes |
| `verify/verify-regression-engine/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/verify-regression-engine/table.test.mjs` | left |  | compared the part's Regression table with a git listing of its PR's base, between pinned commits: its own PR |
| `verify/verify-regression-plugin/bite.test.mjs` | moved | `test/regression/plugin/moved-tests-bite.test.mjs` | breaks the return tool, the observe page's data reader and the journal check in a scratch copy of the head and runs the moved plugin, inspector and journal tests, red each time, green restored |
| `verify/verify-regression-plugin/folders.test.mjs` | left |  | compared a listing of the part's verify/ folders with verdict.json alone |
| `verify/verify-regression-plugin/left-reasons.test.mjs` | left |  | read the base's left test files and matched their text with regexes |
| `verify/verify-regression-plugin/moved-pass.test.mjs` | left |  | ran every file under test/regression/ at once and read their headers against that part's table: the whole set is run by npm test itself, and this second concurrent load is what broke the timing bars (decision 7) |
| `verify/verify-regression-plugin/one-helper.test.mjs` | left |  | read test/regression/ source text and matched its import lines with regexes |
| `verify/verify-regression-plugin/scope.test.mjs` | left |  | read its own PR's file list between pinned commits |
| `verify/verify-regression-plugin/table.test.mjs` | left |  | compared the part's Regression table with a git listing of its PR's base, between pinned commits: its own PR |

| Folder | Other files |
|---|---|
| `clean-room-install-test` | none: the folder held only its test file |
| `comments-present-tense` | `compare.mjs`, `strip.mjs` deleted; 3 evidence files deleted |
| `done-with-the-build` | `lib.mjs` inlined into the moved file and deleted; 7 evidence files deleted |
| `effort-scope-own-pr` | `lib.mjs` deleted; 4 evidence files deleted |
| `env-bootstrap` | none: the folder held only its test file |
| `evidence-gate-edges` | `lib.mjs` inlined into the moved file and deleted; 7 evidence files deleted |
| `first-real-issue` | 11 evidence files deleted |
| `fix-budget-rule` | `lib.mjs` inlined into the moved file and deleted; 1 evidence file deleted |
| `fix-event-close-tag` | `wake-lib.mjs` inlined into the moved file and deleted; 5 evidence files deleted |
| `fix-trace-writes-clone-cwd` | `lib.mjs` inlined into the moved file and deleted; 4 evidence files deleted |
| `fresh-reader-gaps` | `lib.mjs` deleted; 6 evidence files deleted |
| `item-head-trim` | `lib.mjs` inlined into the moved file and deleted; 6 evidence files deleted |
| `map-once-traps-written` | `lib.mjs` inlined into the moved file and deleted; 5 evidence files deleted |
| `pinned-fetch-temp-repo` | `lib.mjs` deleted; 5 evidence files deleted |
| `plan-reader-effort` | `lib.mjs` inlined into the moved file and deleted; 10 evidence files deleted |
| `probe-plugin-agents` | 30 evidence files deleted |
| `probe-plugin-agents-thread` | 4 evidence files deleted; `evidence/agent-adda18087b10e0b3a.jsonl` among them, whose copy is `test/regression/fixtures/agent-transcript.jsonl` |
| `refine-brief-stage` | `lib.mjs` inlined into the moved file and deleted; 2 evidence files deleted; `evidence/real-case.json`, `evidence/real-runs.json`, `evidence/verifier-methods-copied.json` and `evidence/verifier-paraphrased.json` moved to `test/regression/fixtures/brief-bench/` (input) |
| `retire-doing` | `lib.mjs` inlined into the moved file and deleted; 6 evidence files deleted |
| `retro-first-item` | 3 evidence files deleted |
| `rule-text-tests` | `lib.mjs` deleted; 3 evidence files deleted |
| `rules-said-once` | `lib.mjs` inlined into the moved file and deleted; 7 evidence files deleted |
| `scope-suite-own-pr` | `lib.mjs` deleted; 4 evidence files deleted |
| `self-edit-check-snapshot` | `lib.mjs` inlined into the moved file and deleted |
| `self-update-by-version` | none: the folder held only its test file |
| `test-fixture-edges` | `lib.mjs` inlined into the moved file and deleted; 5 evidence files deleted; `to-base.diff` deleted (the reverse diff of the build, used only by the left halves) |
| `tournament-kit` | `toy/2026-11-04-readme-structure/` moved to `test/regression/fixtures/tournament/` (input) |
| `tournament-scoring-floors` | `toy/2026-11-04-recipe-cards/` and `rescore/` moved to `test/regression/fixtures/tournament/` (input) |
| `trial-fail-path` | `lib.mjs` inlined into the moved file and deleted |
| `verdict-cutoff-at-verified-sha` | `lib.mjs` inlined into the moved file and deleted; 7 evidence files deleted |
| `verification-contract` | `lib.mjs` inlined into the moved file and deleted; 8 evidence files deleted |
| `verifier-reader-gaps` | `gate-fixture.mjs`, `lib.mjs` inlined into the moved file and deleted; 1 evidence file deleted |
| `verify-evidence-policy` | `lib.mjs` inlined into the moved file and deleted; 7 evidence files deleted |
| `verify-regression-engine` | `lib.mjs` deleted; 8 evidence files deleted |
| `verify-regression-plugin` | `lib.mjs` deleted; 8 evidence files deleted |

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's moved tests first, write your own under `verify/verify-regression-set/`:

- **table-complete:** at the PR base, list `verify/*/` and keep the folders whose item's status is `done` (read
  `plan/items/<id>.md` at the base) other than this item's; list their `*.test.mjs` and `*.test.js` with `git
  ls-tree`, parse the `## Regression table` at the head, compare the two sets, check each destination exists.
- **folders-hold-verdicts:** read the head tree of each of those folders, and check that no other folder under
  `verify/` holds a test file unless its item is not done at the head.
- **moved-pass:** run `node --test` on each file under `test/regression/` from a child process (drop
  `NODE_TEST_CONTEXT` from its env), all at once, then again with a `NODE_PATH` and module resolution that cannot
  find Playwright; parse each file's first comment for `<item>/<expect-id>` and check it against
  `plan/items/<item>.md`; grep for `verify/` paths read.
- **one-helper:** walk `test/regression/`, parse `import` lines, count importers per `lib.mjs` export.
- **moved-bite:** for one moved test in each of `plan/` and `gates/` that holds one (and one other area this PR adds
  to), copy the head to a temp folder, break what the test asserts in `plan/check.mjs`, `scripts/` or `packages/`, run
  that test there, show red; restore, show green.
- **left-reasons-hold:** read every left test at the base; put any row you disagree with in `observations`. Fail the
  line only for a left test that drove behaviour and asserted on the result without a stored capture.
- **scope:** `git diff --name-only <base> <head>`; for any changed file outside the retired folders,
  `test/regression/` and the item file, show that it belongs to an item not done and that its diff only re-points or
  drops the read of a file this PR moved or deleted, or that it is `docs/traps.md` and its diff only drops the name of
  a test file this PR deletes.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again. No
listings.
