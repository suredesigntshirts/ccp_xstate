# The regression set's moved-pass cost goes to a follow-up item (2026-11-09)

Claude's two-way-door decision as stand-in for the person, made by the builder of `verify-regression-set`.

## What was measured

At `verify-regression-set`'s build head (9765a77), CI's parallel pass took 1,090 s against 631 s on #274.
`verify/verify-regression-set/moved-pass.test.mjs` alone took 806 s, because it runs all 76 `test/regression/` files
inside `npm test` twice (once with Playwright hidden), on top of the one run `npm test` already gives them. The
moved-pass suites of `verify-regression-engine` and `verify-regression-plugin` do the same, more cheaply.

## Decision

The fix is not part of `verify-regression-set`'s build. The suite is the verifier's, under `verify/`, and the
build's scope does not reach it. Changing it there would also cost another verdict on a PR that is already verified.
It goes in the draft `regression-set-leftovers`, which already holds this cost. That item's outcome now names it:
a moved-pass suite either runs only on its own item's PR, or leaves with its item's other done tests once `npm test`
holds the outcome. Whichever it picks, it no longer adds a second run of the regression set to every PR's `npm test`.

## Not taken

- Reusing the main pass's results inside moved-pass. That couples a verify suite to how `npm test` reports, and the
  verify folders are going away in any case.
