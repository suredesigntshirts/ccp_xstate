# traps-homed

Read with `read_thread` (full bodies): the memory-boundary-check builder
(`cmsg_01VhYV3jhQ9s4qrrh2th12sN59jNc3V68fd2ZLV6KULdk9`), the second-workflow builder
(`cmsg_01VhYV3jhQ9s4qrrh2th12sNWnUTYuH9V5sYfU3qRE4N7M`) and verifier
(`cmsg_01VhYV3jhQ9s4qrrh2th12sNBALxb61puq7VezRGda1a9D`). Read the bodies and diffs of the build PRs 301 and 306 and
the follow-up PR 310 (`git show 87bcdebd --stat`, `plan/decisions/2026-11-11-second-workflow-run.md`).

| Trap | Named in | Home |
|---|---|---|
| Stale `origin/main` in the clone | PR 301 | `docs/traps.md` at the PR head |
| `ci` run with no jobs | PR 301 | `docs/traps.md` at the PR head |
| Delete shape for memory sync | PR 301 | `plan/ledger/platform.md`, L-memory-delete-shape (platform fact) |
| Draft PR stops the engine's merge | builder reply, PR 310 | `docs/traps.md` on main; not yet on the build branch, which has not merged main since PR 310 |
| Self-modification refusal on widening the grant | builder reply, PR 310 | `docs/traps.md` at the PR head |
| Release command refused | PR 310 decision file | `docs/traps.md`, "What a thread may not do to GitHub" |
| `bin/host.js` run from the checkout records the repo's release unless given `--release` | PR 310 decision file, "What it left" | **none**: not in `docs/traps.md`, `docs/verifying.md` or any plan item (`git grep -- --release origin/main -- docs plan/items plan/ledger`), and the report does not name it |

Defects went to plan items: `fix-refused-start-poisons-item`, `fix-merge-draft-pr`, `fix-time-ci-from-notifications`.

`node --test verify/memory-boundary-check/report.test.mjs` at 32f515f9: 7 pass, 2 fail ("draft PR stops the merge",
"host.js from the checkout needs --release").
