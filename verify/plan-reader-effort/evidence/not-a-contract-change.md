# not-a-contract-change

`node --test verify/plan-reader-effort/not-a-contract-change.test.mjs` (4/4 pass). Temp repo whose base copies the
head's plan/, scripts/, package.json, sets clean-room-install-test to `doing` and adds
verify/clean-room-install-test/verdict.json. Branch replan/clean-room-install-test-done; gate run as
`BASE_SHA=<base> HEAD_SHA= PR_BRANCH=replan/clean-room-install-test-done PR_BODY= PR_LABELS='["replan"]' node scripts/gates/pr-gate.mjs freeze`.

- status done + done_on 2026-11-09 + reader_effort only: exit 0 "freeze gate passed"
- the same plus expect[0].check changed: exit 1 "freeze gate failed: changes the contract of clean-room-install-test (its head or Verifier brief); verify/clean-room-install-test/verdict.json exists, so verification has started and nothing may change it"
- an already-done item changing only reader_effort.reader_lines: exit 0
- control: the temp tree's contract() edited to stop dropping reader_effort: the done-only PR exits 1 naming the item, so the pass comes from contract()
