```json
{
  "id": "retire-unmarked-reading",
  "title": "Retire the engine's reading of a model stage without marks",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "marks.js reads only declared marks: a model stage with no meta.marks entry has no verdicts, briefs or refs, the load check refuses an unmarked stage whose output holds a ref or whose verdict the chart decides on, and no engine source tests the name brief, the words PASS or FAIL, or a ref's url.",
  "why": "The unmarked reading is the last place the engine guesses a workflow's rules (L-rules-in-spec-not-host); retire-pinned-legacy kept it because done suites assert it (plan/decisions/2026-11-08-retire-pinned-legacy.md).",
  "serves": [
    "L-rules-in-spec-not-host",
    "L-count-concepts"
  ],
  "depends_on": [
    "retire-pinned-legacy"
  ]
}
```

Draft from `plan/decisions/2026-11-08-retire-pinned-legacy.md`, "The unmarked reading in marks.js stays, for now".
Not ready: it needs a decision on updating the done suites that assert the reading
(verify/stage-contract-declares-rules, verify/stage-prompt-files/files.test.mjs,
verify/prompt-catalogue/same-text.test.mjs), which fix-blocked-retry's decision 9 does not cover, and the inline
test specs that rely on it marked.
