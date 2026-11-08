```json
{
  "id": "retire-brief-file-fallback",
  "title": "Retire the engine's brief.md fallback for a run's prompt file",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "promptFile() names prompt.md and nothing else; every committed run folder holds prompt.md; no engine or plugin source reads or names brief.md.",
  "why": "The fallback is a special case kept alive by six tests that assert it; 313 committed brief.md files (293 bench, 14 tournaments, 6 verify) move with git mv (define errors out of existence; research plan/research/verification-swing.md, item 4).",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-regression-set"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 4. Measured on 8 Nov at c6fc6db: removing the fallback fails
6 of 936 tests, all of which assert the fallback itself. Waits for `verify-regression-set` because those six are in
done suites. The `git mv` of bench and tournament files is history, not a behaviour change; the stage bench's
runner reads `prompt.md` after it.
