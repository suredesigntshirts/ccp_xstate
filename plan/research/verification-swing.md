# The verification swing: what the seven cleanups showed, and what to build

**Date:** 2026-11-08
**Asked by:** the person, thread "Review quality of the seven finished cleanups": count what the seven design-books
cleanups added and removed, judge them against `plan/research/design-books-cleanup.md`, and file the follow-up work
so it gets done in the harness without drifting in fresh sessions.
**Sources:** the seven build PRs (#159, #163, #166, #169, #173, #176, #180) and the eighth (#183), measured at `main`
c6fc6db and 83c9f56; `verify/` read whole; the three concept summaries the earlier research used. The full review
with its tables is a Claude Doc (https://claude.ai/artifact/4g28QZToF2P1EEiUBZRKH7); this file holds what a session
needs to build from.
**Status:** research plus filed items. The decisions are in `plan/decisions/2026-11-08-verification-swing.md`.
`verification-contract` is ready; the rest are drafts in build order.

## Read this first, if you are building any item below

- **Two things are called verify.** `verify/` is the *plan verifier*: a separate session writes tests and a
  `verdict.json` per plan item, and the `verdict` gate reads it. The `verify` *model stage* in `workflows/quick-fix/`
  is an agent that checks a run's Expect lines at a PR head. Everything here is about the plan verifier. Do not touch
  `workflows/quick-fix/verify.md` or the quick-fix machine for this work.
- **Use the glossary.** `docs/language.md` is the vocabulary for Expect lines, decisions, commits and code: plan stage
  and model stage, brief and prompt, plan verdict and verdict field, run state, attempt budget, marks. Three words are
  pre-chosen for this series (decision 6): *regression set*, *observation*, *contract change*.
- **Rules you will read that this series changes.** Until `verification-contract` lands, three texts say the
  opposite of what these items do. `CLAUDE.md` "A cleanup changes structure, not behaviour" (decision 4),
  `plan/README.md` "The contract is frozen" (decision 3), and `docs/gates.md` "The verdict" (decision 2). The
  decision file gives the old and the new text. An item in this series cites the decision as its exception, and the
  build of `verification-contract` rewrites the texts.
- **The numbers in this file are from 8 Nov.** Re-measure before writing a number into a PR, and never write one
  into an Expect line: "14,806 lines become N" is the byte-pinning habit this series ends (decision 1).
- **Standing rules that still hold.** The verifier is a separate session and writes its tests without reading the
  builder's. One item per PR, branch `build/<item-id>`, `Item:` line in the body, merge on green `ci` and `verdict`.
  Stand-in decisions go in `plan/decisions/`. Threads never block on the person. Round limits: two for a small item,
  three for a big one.
- **Traps.** Container clones can be shallow (`git fetch --unshallow origin` before git-history evidence).
  Containers sign commits (`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false` for evidence with shas). Never
  run `npm test` on a checkout and its worktree at once. Until `verify-regression-set` lands, a workflow edit breaks
  the six frozen snapshot suites. Labelling a PR `replan` after creating it fails the first gates run; the labelled
  rerun passes. A thread waiting on CI may not wake; check the run if a wake is overdue.

## The short version

The seven cleanups made the harness clearer and neither smaller nor simpler. Production code moved +1,841/−1,737
(net +104 lines); exports went from 135 to 194 and engine source files from 20 to 30; the engine README doubled.
Three fallbacks the research meant to remove were kept and one was added. Of the 34,865 lines the seven PRs added,
28,440 (82 percent) were verifier evidence: full journal roots, `.pass` listings and captures of main. The one net
deletion was the inspector (−574 lines).

The cause is not the builders. Every item was held to Expect lines of the form "every stage renders to main's
bytes", "npm test at both shas", "every test that passes on main passes at the head". A verifier given such a line
archives main and compares, which is what happened: six done suites hold `main-prompts.json` and
`main-scenarios.json`, one holds a 11,684-line trace, and all stay live forever. So each cleanup could add but not
remove, and each later item inherited every earlier item's ceiling. `CLAUDE.md`'s "structure, not behaviour" was
read as "bytes, not behaviour".

The verifier itself works: 499 tests, about 2,500 assertions, all code. Its behavioural tests (drive the engine,
load a workflow, run the plan check on a copy) are the system's only independence and catch real builder slop.
About a fifth of its test files read source text or compare captures instead, and nothing ties a MET to a test
result: the gate reads the word. The fix is to the contract and the gate, not to the verifier's existence.

## The items, in build order

| # | Item | What it does | Pattern | Size |
|---|---|---|---|---|
| 1 | `verification-contract` (ready) | Expect lines name behaviour (check.mjs deny-list); a verdict result names its test and the gate runs it, with `observations`; one contract change before verification; the three rule texts rewritten | Design by Contract; make the implicit explicit; design it twice | S, 2 rounds |
| 2 | `verify-regression-set` | Sort every test in the 61 done suites: behavioural tests move to `test/regression/<area>` with one helper; regex, listing and capture tests leave with their evidence; `verify/<item>/` keeps the verdict | Fix broken windows; DRY as knowledge; ETC; complexity is the reader's cost | L, 3 rounds, split by area if a round shows it |
| 3 | `retire-unmarked-reading` (existing draft) | Remove the inferred marks reading | Define errors out of existence | S |
| 4 | `retire-brief-file-fallback` | Remove `promptFile`'s `brief.md` fallback; `git mv` the 313 committed files | Define errors out of existence | S |
| 5 | `verify-evidence-policy` | One packed file per Expect line; gate refuses `.pass` and files over 64 KB under `verify/` | DRY; evidence says what was shown | S |
| 6 | `run-message-and-budget` | Design the run's one state message and one budget twice, pick on the stage bench | Design it twice; pull complexity downward | M |
| 7 | `plan-reader-effort` | A derived view per PR: files touched, lines a reader opens, exports added, beside the fix budget | Complexity is what the reader experiences; ETC measured | S |
| 8 | `actors-module-seam` | Importers move off `actors.js` to the module that owns what they use; the engine README shrinks | Deep modules; information hiding | M |

Items 3 and 4 wait for 2 because today their deletions fail six tests each, all in done suites that assert the
fallback. Item 5 can run beside 2. Items 6 to 8 are design work and deserve the stage bench.

## What each cleanup did against its finding

- **comments-present-tense (#159, +3,873/−234, code +150/−139).** 76 history references went to 1 and the stubs
  gate refuses new ones. The README grew from 127 to 271 lines explaining the engine; a reader pays for that on every
  open.
- **run-names-one-module (#163, +3,704/−63, code +110/−63).** `names.js` is a clean module; the three copies it
  replaced are gone. Added a 3,269-line evidence listing.
- **harness-glossary (#166, +5,651/−206, code +151/−101).** `docs/language.md` is good and is now the vocabulary.
  The rename to `prompt.md` kept a `brief.md` fallback in `promptFile()`; journal v2 kept a v1 upcaster (correct,
  per L-version-event-schema: 319 committed v1 journals).
- **run-lifecycle-store (#169, +13,385/−617, code +785/−606).** The best module of the series: `run/store.js`
  with STATES, TRANSITIONS, ANSWERS and BUDGET tables. `actors.js` went from 900 to 312 lines but re-exports the
  `run/` modules, so 51 importers never moved. Two decisions deferred: no single "run is in state X" message, three
  caps in BUDGET rather than one. 71 evidence files, 11,684 lines.
- **stage-contract-declares-rules (#173, +2,970/−181, code +324/−105).** `meta.marks` moved the rules into the
  workflow, and `refs/` split the checkers. `marks.js` kept an `inferred` reading (actor `brief`, PASS and FAIL words,
  a url-shaped ref) because four done-suite tests asserted it. Its verifier's `marks-checked` test, 17 wrong
  declarations each refused by name, is the model of what a verifier should write.
- **retire-pinned-legacy (#176, +532/−40, code +58/−16).** Removed three compatibility branches and added a
  `retired` mark. Smallest and cleanest PR of the series.
- **inspector-reads-records (#180, +4,750/−1,298, code +263/−707).** The only net deletion. `export.mjs` lost 509
  lines of guessing; the engine gained `explain()` so the record carries what the inspector used to infer.
- **fix-budget-rule (#183, +677/−4).** The rule works on item metadata, which is the right level, and its "design
  item" is item 6 here under another name. Its verifier repeated the two habits: a 173-line listing as evidence and
  the README tested by regex. Its window is read from the wall clock, and it counts by the `fix-` prefix only.

## The book patterns, and why each matters here

| Pattern | Source | What it says | Why it matters for this harness |
|---|---|---|---|
| Design by Contract | Pragmatic Programmer | Specify postconditions; test the contract, not the implementation | Expect lines are postconditions. In bytes they freeze the implementation; in behaviour they free it |
| Easier To Change | Pragmatic Programmer | Good design is whatever makes the next change easier | A change that forces seven suites to re-capture snapshots fails ETC by construction |
| Fix broken windows | Pragmatic Programmer | Visible decay breeds more | 55 copied helpers and 29k lines of archived JSON taught each verifier that this is normal |
| DRY as knowledge | Pragmatic Programmer | One authoritative representation per piece of knowledge | The budget caps, the verifier scenario and the Expect line each live in several places |
| Tracer bullets | Pragmatic Programmer | Get an end-to-end path working, then adjust the aim | The one contract change during build is the adjustment; today the aim is fixed before the first shot |
| Design it twice | Ousterhout | Sketch two designs before picking one | Cleanups 4 to 6 took the first design; so did the deferred one-message and one-budget decisions |
| Deep modules | Ousterhout | A small interface over a lot of function | `run/store.js` is deep; `actors.js` as a re-exporting facade is shallow and keeps every importer attached |
| Define errors out of existence | Ousterhout | Remove the special case instead of handling it | The inferred reading and the `brief.md` fallback are special cases kept alive by tests that assert them |
| Complexity is the reader's cost | Ousterhout | What a reader experiences, weighted by how often | Measure files touched and lines read per change, not lines added; the gates measured neither |
| Ubiquitous language | Evans | One vocabulary per bounded context, used in code, tests and speech | `docs/language.md` exists; Expect lines and verdicts should be written in it |
| Make the implicit explicit | Evans | Surface a hidden concept as a named thing | The judged-versus-run split in a verdict is implicit; `observations` names it |
| Refactoring toward deeper insight | Evans, Fowler | The model must keep moving; tests at the behaviour level make that safe | A frozen contract and byte-level suites remove that freedom |

## How to classify a verifier test (for `verify-regression-set`)

Read the test, not its name. It **moves** when it calls the engine, the host, a hook, the plan check or a gate on a
copy or temp root and asserts on what came back or what was written. It **leaves** when it reads a source file and
matches a regex, compares a `.pass` or spec-reporter listing, hashes a render or a scenario and compares with a
stored capture, or asserts that a file's bytes equal main's. A test that does both is split before it moves. Every
file gets one row in the item's table: path, verdict (move to `<area>` or leave), one reason. Suites with no tests
(`first-real-issue`, `probe-*`, `person-setup-sitting`, `tool-docs-downloader`, `fix-inspector-guard-label`,
`inspector-catalogue-entries`) keep their verdict and lose their evidence. The two root fixes from the 8 Nov time
audit ride along when their tests move: the no-self-edit test inherits the environment and overrides `HOME` only,
and the copy-not-link clone drops inherited tags.

## What done looks like for the series

- An Expect line can be read by someone who knows only the glossary and the item's outcome.
- Deleting dead code breaks only tests that assert the dead code, and those leave with it.
- The `verdict` gate decides MET from a test run it can name; the verifier's judgement sits in `observations`.
- `verify/` holds verdicts; `test/regression/` holds the behaviour every past item proved, with one helper.
- A later review of this kind is answered from a derived view instead of a hand count.
