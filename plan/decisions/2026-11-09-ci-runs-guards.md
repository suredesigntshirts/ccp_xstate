# CI runs the guards a PR needs; proofs run once, on their own PR (2026-11-09)

Claude's two-way-door decision as stand-in for the person, after the person asked on 9 Nov that CI not rerun tests a
PR does not need (thread "Find why npm test is slow in CI").

## Decision

- **Proofs run once.** A verifier suite under `verify/<item>/` is the proof of one PR. The verdict gate already runs the
  tests a verdict names at that PR's head; `npm test` stops running `verify/` (`regression-set-leftovers`). A proof of
  behaviour other code relies on moves to `test/regression/` as a guard.
- **Guards do their setup once.** Mutation checks name the tests they need; nested runs and fixtures run once
  (`faster-nested-test-runs`).
- **A PR runs the guards it reaches; main runs all** (`pr-test-selection`). A miss shows on main one merge later.

## Not taken

- A separate CI job for `verify/`: it keeps re-proving done items on every PR, only in parallel.
- Running `verify/` on main only: proofs of done items are frozen against the code of their day and rot; nobody acts on them.
- Moving the moved-pass check into `npm test` as a guard: it reruns all of `test/regression/`, which `npm test` already runs.
