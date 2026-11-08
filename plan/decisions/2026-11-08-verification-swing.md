# The verification swing: what the plan verifier may ask for, and what happens to done suites (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, after the quality review of the seven design-books
cleanups (`plan/research/verification-swing.md`; the person asked for the work to be filed, 8 Nov 08:09Z). Each
decision below is one a fresh session would otherwise have to make again, and most of them override a rule a
session will find written somewhere else. Where they do, the old text and the new are both given.

## 1. An Expect line names behaviour, never main's bytes

A ready or doing item's Expect `check` may not pin the repository's current state. `plan/check.mjs` refuses a check
that contains a sha of seven or more hex digits, or any of: "as on main", "as main", "on main", "than main",
"main's", "unchanged", "same as", "byte", "bytes", "both shas". The match is case-insensitive and whole-word. Done,
dropped, parked and draft items are exempt, so nothing already landed is re-opened and a draft may still hold its
author's shorthand until it is readied. Paths are allowed in a check: naming `plan/README.md` is not pinning it.

The standing line "every test that passes on main passes at the head" leaves every future item. It is `ci` already
(`npm test` at the head), and written per item it taught verifiers to archive main and compare.

Why a deny-list and not a vocabulary allow-list: the glossary has 70 terms and a check needs ordinary words around
them. The list names the five ways the seven cleanups pinned main, which is the failure seen. A sixth way, when it
appears, is a line added to the list, not a new mechanism.

## 2. A verdict result names the test that proves it

A result for an Expect line with proof `verifier` or `builder` carries `test`: a path under `verify/<item>/` and,
optionally, a test name. The verdict gate runs it (`node --test <file>`, with `--test-name-pattern` when a name is
given) at the PR head and refuses the PR when it fails or when the field is missing. A `world` line keeps `command`
and `excerpt` only, since the world is not a test the gate can run. Every result keeps `command` and `excerpt`.

The verdict gains `observations`: a list of strings for what the verifier judged rather than ran (a naming
concern, a design smell, a doc gap). It never gates and needs no item id. The two earlier verifier observations
recorded in item prose (`stage-contract-declares-rules`, `retire-pinned-legacy`) are the kind of thing that goes
there.

What this does not do: it does not make CI the verifier. The verifier still writes the tests without reading the
builder's and still decides what to try to break. It stops the yes or no from being a word.

## 3. One contract change before verification starts

A `doing` item's head and Verifier brief may change once, by a replan PR, before `verify/<item>/verdict.json`
exists. The replan raises `contract_changes` from absent to 1 and adds a `## Contract change` section to the item
file saying what shape the build tried, what it was compared with and why the contract moved (design it twice).
`plan/check.mjs` refuses `contract_changes` above 1 and a value of 1 without the section. The freeze gate refuses
any head or brief change, replan label or not, once a verdict file for the item exists in the PR's base or head.

Old text, `plan/README.md` "How slop is kept out": "Once an item's build starts, CI refuses a PR that changes its
head or Verifier brief. Only a PR labelled `replan` that touches nothing but `plan/` may change them." New text:
"Once an item's verification starts, nothing changes its head or Verifier brief. Before that, one replan may, with
a `## Contract change` section." The replan-touches-only-`plan/` rule stays.

## 4. Done suites retire; their behaviour moves, their archives leave

A done item's verifier tests are not a permanent fixture. After `verify-regression-set`, `verify/<item>/` holds
`verdict.json` and, for the item that is being verified, its tests. A behavioural test (it drives the engine, loads a
workflow, runs a hook, runs the plan check on a copy) moves to `test/regression/<area>.test.mjs`, where area is a
glossary context or module: `engine`, `run`, `marks`, `journal`, `plugin`, `inspector`, `plan`, `gates`. Its header
comment keeps the Expect id it came from. A test that reads source text with a regex, compares a listing, or hashes
a capture against a stored one is deleted with its evidence.

This is not a naive deletion pass (ledger L-measure-then-park): the build item classifies every test file by name in
a table in its PR and item prose, with the reason, and the verifier checks the table against the files. Six suites
hold `main-prompts.json` and `main-scenarios.json` and one holds `evidence/main/trace.json`; all go.

Old text, `CLAUDE.md`: "A cleanup changes structure, not behaviour. Tests that pass on `main` pass at its head,
changed only for the renames and imports its item names." New text: "A cleanup changes structure, not behaviour.
Behaviour is what the glossary names and the regression set asserts. A test that asserts bytes, a listing or a
retired path leaves with the code it pinned, named by the item." The build item `verification-contract` makes the
edit, since a replan may not touch `CLAUDE.md`; until it lands, items in this series cite this file as their
exception. `plan/decisions/2026-11-05-blocked-retry.md` decision 9 ("snapshots are re-captured, assertions are not
touched") is superseded for snapshots that compare against main: they are deleted, not re-captured.

## 5. Evidence is what was shown

A verifier commits, per Expect line, one file: the command, the excerpt and the inputs needed to run it again. No
`.pass` listing, no journal root, no copy of a capture of main. The gate refuses a PR that adds a file under
`verify/` larger than 64 KB or a file whose name ends in `.pass`. Existing evidence is removed by
`verify-regression-set`, not by this rule.

## 6. The words

Three glossary lines are added by `verification-contract`, in the Plan context: *regression set* (the behavioural
tests of done items, under `test/regression/`, one helper), *observation* (a verifier's judged note on a verdict,
never a gate) and *contract change* (the one replan a doing item may have before verification). Say *plan verifier*
when the `verify` model stage could be meant.

## Not adopted

- Making item 4 exempt from the fix budget or the round limits. It is a design item in the budget's sense only if
  it names a module; it names none.
- Letting the regression set keep a test that compares against a stored capture "because it is fast". Speed is not
  the reason those tests exist; conservation is.
- A separate verifier identity. Still parked (ledger L-same-account-everywhere).
- Changing the `verify` model stage or `workflows/quick-fix/verify.md`. Different thing, same word.
- Counting fixes by anything other than the `fix-` prefix, or changing the 14-day window. Noted in the review as a
  gap; the fix budget is a day old and has not been seen to fail.
