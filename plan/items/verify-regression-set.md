```json
{
  "id": "verify-regression-set",
  "title": "Retire the done suites into one regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
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
  ]
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
