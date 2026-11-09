# reader-answers

Clean clone of 296367527a73b4686f6f69a2ba47e17939a6d97e, `npm ci`, then per question:
`node scripts/fresh-reader.mjs --cwd <clone> "Answer this question from the files of this repository alone. Name the file that answers it, and quote the lines you rely on.\n\nQuestion: <q>" -- --max-turns 25`.
The prompt names no file and no term. A run is complete when its answer holds the question's home path and every carrying term, case and whitespace ignored. Each question ran once, four at a time; a question whose run was not complete runs three more times, and counts as answered when most of its runs are complete. Question 12, which missed half its runs in round 2, ran three more times here anyway.

| # | home | runs | complete | what the incomplete runs lacked |
|---|---|---|---|---|
| 1 | docs/traps.md | 1 | 1 | - |
| 2 | docs/traps.md | 1 | 1 | - |
| 3 | docs/traps.md | 1 | 1 | - |
| 4 | docs/traps.md | 1 | 1 | - |
| 5 | docs/traps.md | 1 | 1 | - |
| 6 | docs/verifying.md | 1 | 1 | - |
| 7 | docs/verifying.md | 1 | 1 | - |
| 8 | docs/verifying.md | 1 | 1 | - |
| 9 | plan/ledger/platform.md | 1 | 1 | - |
| 10 | plan/ledger/platform.md | 1 | 1 | - |
| 11 | plan/ledger/platform.md | 1 | 1 | - |
| 12 | plan/ledger/platform.md | 4 | 4 | - |

Earlier rounds. Round 1 at b467da6d: question 11 named only `plan/research/probe-plugin-agents.md` in 3 of 3 runs. Round 2 at da330bfc: question 11 complete; question 12 complete on 2 of 4 (the others read `scripts/fresh-reader.mjs` and said the repo does not describe the sign-in); question 8 on 3 of 4.
