# traps-homed

Read the PR at 70a380c9 (`git diff main...pr301`), the builder thread's latest replies with `read_thread`
(cmsg_01VhYV3jhQ9s4qrrh2th12sN59jNc3V68fd2ZLV6KULdk9), and the previous verifier's trap table, which read all three
observed threads.

| Trap | Home at the head |
|---|---|
| Stale `origin/main` in the clone | `docs/traps.md`, "The checkout's `origin/main` can be days old" |
| `ci` run with no jobs | `docs/traps.md`, "A `ci` run that has no jobs" |
| Delete shape for memory sync | `plan/ledger/platform.md`, L-memory-delete-shape |
| Draft PR stops the engine's merge | `docs/traps.md`, now on the branch since main was merged in |
| Self-modification refusal on widening the grant | `docs/traps.md`, "What a thread may not do to GitHub" |
| Release command refused | `docs/traps.md`, "What a thread may not do to GitHub" |
| `bin/host.js` from the checkout records 0.1.0 without `--release` | `docs/traps.md`, "A host run from the checkout records release 0.1.0" |

Checked the new entry against the code: `packages/engine/bin/host.js` line 108 reads
`opts.release ?? process.env.CCP_HARNESS_RELEASE ?? manifestRelease()`, and `plugins/harness/.claude-plugin/plugin.json`
says `"version": "0.1.0"`, as the entry says. Defects are plan items: `fix-refused-start-poisons-item`,
`fix-merge-draft-pr`, `fix-time-ci-from-notifications`.

`node --test verify/memory-boundary-check/*.test.mjs` at 70a380c9: 9 pass, 0 fail.
