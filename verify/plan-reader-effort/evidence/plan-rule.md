# plan-rule

`node --test verify/plan-reader-effort/plan-rule.test.mjs` (7/7 pass). Each case copies the head's plan/ to a temp
dir, rewrites one item head, optionally writes `<tmp>/verify/<id>/verdict.json`, runs `node <tmp>/plan/check.mjs`.
Build item: clean-room-install-test; probe item: probe-platform-baseline.

- untouched copy: exit 0 "plan ok"
- done, done_on 2026-11-09 and 2026-12-01, verdict, no reader_effort: exit 1 "items/clean-room-install-test.md: a build item done from 2026-11-09 records reader_effort: node scripts/reader-effort.mjs <pr> --json"
- reader_effort with `minutes`: exit 1 "...reader_effort: unknown field minutes"; reader_lines 1.5 / files "28" / added.code 2.5: "must be an integer"; removed.styles: "unknown field styles"
- well-formed reader_effort (PR 189's numbers): exit 0
- no verdict file: exit 0; done_on 2026-11-08 with verdict: exit 0
- done probe, 2026-11-09, with and without verdict, no reader_effort: exit 0
