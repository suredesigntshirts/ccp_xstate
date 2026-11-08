```json
{
  "id": "verify-regression-set",
  "title": "Retire the done suites into one regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Every test under verify/ for a done item is either moved to test/regression/<area>.test.mjs with its Expect id in its header and one shared helper, or deleted with its evidence because it read source text, compared a listing or compared a capture of main; verify/<item>/ holds verdict.json for done items; the item's PR and prose carry a table with one row per test file, its verdict and its reason; and no engine, plugin or workflow source changes.",
  "why": "61 live suites that assert main's bytes let code be added but never removed; the classification is per test, not a deletion pass (L-measure-then-park; research plan/research/verification-swing.md, How to classify a verifier test; decision 4).",
  "serves": [
    "L-contract-names-behaviour",
    "L-measure-then-park",
    "L-count-concepts"
  ],
  "depends_on": [
    "verification-contract"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 2, and `plan/decisions/2026-11-08-verification-swing.md`,
decision 4. Not ready: inputs, outputs, Expect lines and the Verifier brief are to write when it is readied, under
`verification-contract`'s rule (no check may say "as on main" or count lines).

What is known now:

- Areas: `engine`, `run`, `marks`, `journal`, `plugin`, `inspector`, `plan`, `gates`. One helper module,
  `test/regression/lib.mjs`, replaces the 55 per-suite helpers; it grows only what two moved tests share.
- Known deletions: `main-prompts.json` and `main-scenarios.json` in six `fix-*` suites, `run-lifecycle-store`'s
  `evidence/main/trace.json` and its 70 other evidence files, every `.pass` listing (about 16,700 lines), the regex
  tests over READMEs and source (`comments-present-tense/readme.test.mjs`, `fix-budget-rule/rule-written.test.mjs`,
  the `no-guessing` and `one-check` greps). Known moves: `stage-contract-declares-rules`'s `marks-checked` and
  `declared-rules-hold`, `run-lifecycle-store`'s `states` and `answers` scenarios, `retire-pinned-legacy`'s
  `retired-not-run`, `fix-budget-rule`'s `budget-refuses` and `names-module`.
- The two root fixes from the 8 Nov time audit ride along: the no-self-edit test inherits the environment and
  overrides `HOME` only; the copy-not-link clone drops inherited tags.
- If the first round shows the table is too large for one PR, split by area at the replan: `engine` and `run`
  first, then `plugin` and `inspector`, then `plan`, `gates` and `journal`. Each part is one item with the same rule.
- The suite should get faster, not slower; the audit measured 12m51s for the local suite with 661 s in one test.
  Report the time before and after in the PR, as information, not as an Expect line.
