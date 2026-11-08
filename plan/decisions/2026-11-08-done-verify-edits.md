# When a PR may change a done item's verify/ tests (2026-11-08)

Claude's two-way-door decision as stand-in for the person, made when `verify/rules-said-once/suite-and-scope.test.mjs`
was found red in every full clone once its PR merged (item `scope-suite-own-pr`).

## What the gates do today

- **Contract freeze** covers an item's head and `## Verifier brief` under `plan/items/`, nothing under `verify/`.
- **Verdict** runs only the tests the named item's own `verdict.json` names, so a done item's suite is not rerun by
  later PRs' verdict jobs; `ci` runs every suite through `npm test`.
- **Evidence** reads only size and `*.pass` names of files a PR adds or changes under `verify/`.

So no gate stops a PR from editing, moving or deleting another item's `verify/` files. That is already used:
`rules-said-once` trimmed two done items' tests and deleted three, and `verify-regression-engine` moved or deleted 26
done suites.

## Decision

A PR may change a done or verified item's `verify/` tests when its own item names each such file in `inputs` and
`outputs` and says why; the change keeps the Expect line the test proves, or the item says which line it retires
(as the `verify-regression-*` items do). The done item's `verdict.json` and `evidence/` are never edited: they record
what held at `verified_sha`. No new gate: the item's own scope line and its verifier check it.

Why not a gate now: the regression-set series moves every done suite out of `verify/` (`verify-regression-set`
closes it), after which only the item under verification has tests there and the question no longer arises.
