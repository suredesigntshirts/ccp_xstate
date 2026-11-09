# reader-answers

Clean clone of da330bfce4997fd002b80a44f8a74e142fc12acb, `npm ci`, then per question:
`node scripts/fresh-reader.mjs --cwd <clone> "Answer this question from the files of this repository alone. Name the file that answers it, and quote the lines you rely on.\n\nQuestion: <q>" -- --max-turns 25`.
The prompt names no file and no term. A run is complete when its answer holds the question's home path and every carrying term, case and whitespace ignored. Each question ran once, four at a time; a question whose run was not complete ran three more times, and counts as answered when most of its runs are complete.

| # | home | runs | complete | what the incomplete runs lacked |
|---|---|---|---|---|
| 1 | docs/traps.md | 1 | 1 | - |
| 2 | docs/traps.md | 1 | 1 | - |
| 3 | docs/traps.md | 1 | 1 | - |
| 4 | docs/traps.md | 1 | 1 | - |
| 5 | docs/traps.md | 1 | 1 | - |
| 6 | docs/verifying.md | 1 | 1 | - |
| 7 | docs/verifying.md | 1 | 1 | - |
| 8 | docs/verifying.md | 4 | 3 | copying |
| 9 | plan/ledger/platform.md | 1 | 1 | - |
| 10 | plan/ledger/platform.md | 1 | 1 | - |
| 11 | plan/ledger/platform.md | 1 | 1 | - |
| 12 | plan/ledger/platform.md | 4 | 2 | its home, --bare, API key; its home, --bare, API key |

At b467da6d (round 1) question 11 named only `plan/research/probe-plugin-agents.md` in three of three runs; at da330bf its one run names `plan/ledger/platform.md` and every term. The incomplete run of question 12 read `scripts/fresh-reader.mjs` and said the repo does not describe the sign-in; the incomplete run of question 8 left out the temp-repo sentence.
