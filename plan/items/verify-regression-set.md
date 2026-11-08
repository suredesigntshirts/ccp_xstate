```json
{
  "id": "verify-regression-set",
  "title": "Retire the done suites into one regression set",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Every verify/ folder of a done item holds only verdict.json; the remaining suites (plan, gates, setup, bench and tournament) are moved to test/regression/<area>/ or deleted with their evidence by the same per-test rule as verify-regression-engine and verify-regression-plugin, with one table row per test file; test/regression/ holds the regression set of every done item with one helper; and no engine, plugin or workflow source changes.",
  "why": "61 live suites that assert stored captures let code be added but never removed; the classification is per test, not a deletion pass (L-measure-then-park; research plan/research/verification-swing.md, How to classify a verifier test; decision 4). Split by suite into three parts at the replan that readied the first (plan/decisions/2026-11-08-verify-regression-split.md); this is the last, and it closes the series' rule for every done folder.",
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
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 2, and `plan/decisions/2026-11-08-verification-swing.md`,
decision 4. Split on 8 Nov into three parts by suite (`plan/decisions/2026-11-08-verify-regression-split.md`):
`verify-regression-engine` (26 suites: engine, run, marks, and `stage-bench`), `verify-regression-plugin` (19 suites: plugin,
inspector, journal) and this item, which keeps the id so the items that wait for the whole set
(`retire-unmarked-reading`, `retire-brief-file-fallback`, `run-message-and-budget`) still wait for all three.
Readied after `verify-regression-plugin` is done, with the Expect lines and Verifier brief of the earlier parts.

The 19 suites: `clean-room-install-test`, `comments-present-tense`, `env-bootstrap`, `first-real-issue`,
`fix-budget-rule`, `person-setup-sitting`, `probe-platform-baseline`, `probe-plugin-agents`,
`probe-plugin-agents-thread`, `refine-brief-stage`, `repo-skeleton`, `retro-first-item`, `self-edit-check-snapshot`,
`self-update-by-version`, `tool-docs-downloader`, `tournament-kit`, `tournament-scoring-floors`,
`trial-fail-path`, `verification-contract`. Also any item done after the split (such as `verify-evidence-policy`)
whose folder still holds tests when this item is readied.

What is known now:

- Areas for this part: `plan`, `gates`, and the areas the earlier parts used; `setup` or `bench` only if a moved test
  fits none of the eight (add the word to `docs/language.md` first).
- Known deletions: `comments-present-tense/readme.test.mjs` and the regex tests over READMEs and source, every
  `.pass` listing. `rules-said-once`'s build deletes `repo-skeleton/claude-md.test.mjs`,
  `verification-contract/rules-written.test.mjs` and `fix-budget-rule/rule-written.test.mjs`; mark them gone in the
  table. Known moves: `fix-budget-rule`'s `budget-refuses` and
  `names-module`. Suites with no tests (`first-real-issue`, `probe-*`, `person-setup-sitting`,
  `tool-docs-downloader`) keep their verdict and lose their evidence.
- `scope-suite-own-pr` makes `rules-said-once/suite-and-scope.test.mjs` read the PR's file list only on that item's own
  PR; classify the suite as that build leaves it.
- The two root fixes from the 8 Nov time audit landed with `self-edit-check-snapshot` (#192); its tests move as that
  item left them.
- The suite should get faster, not slower; the audit measured 12m51s for the local suite. Report the time before and
  after in the PR, as information, not as an Expect line.
- When this item is done, every done item's `verify/` folder holds only `verdict.json`, and only the item being
  verified has tests under `verify/`.
