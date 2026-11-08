# Retiring the done suites: three parts, one layout (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, made by the builder of `verify-regression-set` when
readying it. They apply decision 4 of `plan/decisions/2026-11-08-verification-swing.md` and the classification rule
in `plan/research/verification-swing.md`.

## 1. Split by suite into three items

Measured on 8 Nov: 64 `verify/` folders, 147 test files (11,678 lines), 42 helper modules (4,393 lines) and about
7.5 MB of other files. One table of 147 rows, with rewrites for the split tests, is past one PR's three rounds. The
split is by suite, not by area, so no test file is shared between two PRs and each part's table is the list of
whole folders it empties; each test still goes to the area it fits.

- `verify-regression-engine`: 25 suites of the engine, the run and the marks. Ready first.
- `verify-regression-plugin`: 19 suites of the plugin, the inspector and the journal.
- `verify-regression-set`: the other 20 and anything done since; it keeps the id, so the three items that already
  wait for it (`retire-unmarked-reading`, `retire-brief-file-fallback`, `run-message-and-budget`) wait for all three
  parts without a change to their files. The tests those items need gone sit in all three parts.

The parts run in order because they share `test/regression/lib.mjs`.

## 2. A folder per area, not one file per area

Decision 4 wrote `test/regression/<area>.test.mjs`. Moved tests go to `test/regression/<area>/<name>.test.mjs`
instead: a moved file stays a git rename the verifier can follow, two suites' top-level names cannot collide, and the
area is still the first thing in the path. A file is named for the behaviour it covers, not for the item it came
from.

## 3. The Expect header

Each moved file opens with a comment naming every Expect line it proves, as `Expect: <item>/<expect-id>`. Decision 4
asked for it; it is an exception to `CLAUDE.md`'s "item ids never in code comments" because the Expect line is the
contract the test proves now, not history, and it lets a reader find the reasoning in the item's prose. Nothing else
in a moved file names an item, a round or a PR.

## 4. One helper, and fixtures are data

`test/regression/lib.mjs` holds what two or more moved test files use. A helper only one file uses is inlined into
that file. The test files of one suite may merge into one moved file, which turns a suite's helper into a helper one
file uses; the table then points several rows at the same destination. The shared helper is for what crosses suites:
the repo root, temp folders that clean up, a temp git repo. Data a moved test reads as input goes to `test/regression/fixtures/`: a real Claude Code transcript, a
recorded hook payload, a small workflow under test. A capture of the harness's own earlier output, kept to compare
the head against, is not input and is deleted with its test.

## 5. Moved, split, left

A test that drove the engine, a hook, the plan check or a gate and compared the result with a stored capture is
split if it also asserts behaviour directly: the direct assertions move, the comparison leaves. Where the comparison
was the only assertion, the test leaves; it is not rewritten into a new test (non-goal of each part), since the
behaviour it guarded is named by the glossary and covered by the package tests or another moved test. The table says
which, per file.
