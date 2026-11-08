```json
{
  "id": "verify-regression-plugin",
  "title": "Retire the plugin, inspector and journal suites into the regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Each of the 19 verify/ folders this item names holds only verdict.json; every test file they held is either moved to test/regression/<area>/ (area plugin, inspector or journal, with the Expect id it proves in its first comment) or deleted with its evidence because it read source text, compared a listing or compared a stored capture, and a test that did both is split; moved tests share test/regression/lib.mjs; the item's prose carries a table with one row per test file, its verdict and its reason; and no engine, plugin, workflow or script source changes.",
  "why": "Second of three parts of verify-regression-set, split by suite (plan/decisions/2026-11-08-verify-regression-split.md); same rule as verify-regression-engine (L-measure-then-park; decision 4 of plan/decisions/2026-11-08-verification-swing.md).",
  "serves": [
    "L-contract-names-behaviour",
    "L-measure-then-park",
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-regression-engine"
  ]
}
```

Draft. Readied after `verify-regression-engine` is done, with its Expect lines and Verifier brief, changed only where
that build's done replan says the rule needs it.

The 19 suites: `engine-item-views`, `fix-agent-finish-ms`, `fix-inspector-guard-label`, `fix-refusal-hints`,
`fix-return-tool-answer`, `fix-waiting-lines-owner`, `fix-waiting-run-stall`, `harness-glossary`,
`inspector-catalogue-entries`, `inspector-reads-records`, `inspector-stage-record`, `journal-schema`,
`obs-journal-vs-world`, `obs-live-capture`, `obs-page`, `obs-person-attention`, `obs-refusal-log`,
`obs-time-and-rework`, `workflow-inspector`.

Known from the research: the four `fix-*` suites' `main-prompts.json` / `main-scenarios.json` comparisons
(`unchanged.test.mjs`) leave; `inspector-reads-records/no-guessing.test.mjs` is a grep and leaves;
`fix-inspector-guard-label` and `inspector-catalogue-entries` hold no tests and keep only their verdict. The
recorded Claude Code transcripts the `real-agent` and `real-session` tests replay are input, not captures, and move
to `test/regression/fixtures/` with their tests.
