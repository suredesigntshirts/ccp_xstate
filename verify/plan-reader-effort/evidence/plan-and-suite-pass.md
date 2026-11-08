# plan-and-suite-pass

At 314dbde98001790c85284a7e28c4be8923ae6fd6 (plus this folder), after `npm ci`:

- `node plan/check.mjs`: "8 stages, 95 items (84 live), 90 ledger rows, 17 cases / plan ok", exit 0.
- `npm test` (local, shallow clone): 1935 tests, 1928 pass, 2 fail, 5 skipped. Both failures are of this container,
  not the build: verify/fix-budget-rule/backfill-true.test.mjs ("first done commit is a shallow boundary; fetch more
  history"; after `git fetch --unshallow origin` it passes 4/0), and verify/rules-said-once/suite-and-scope.test.mjs
  (the known failure where origin/main is reachable). ci's own `npm test` at the head is green (ci.md).
- `git diff --name-only --no-renames $(git merge-base origin/main HEAD) HEAD` before this folder: 11 files, all named
  by the outputs or the item file: docs/gates.md, docs/language.md, plan/README.md, plan/check.mjs,
  plan/item.schema.json, plan/items/plan-reader-effort.md, scripts/gates/lib.mjs, scripts/gates/test/lib.test.mjs,
  scripts/reader-effort.mjs, scripts/reader-effort.test.mjs, test/plan-check.test.mjs. No verify/ folder of another item.
- `node --test verify/plan-reader-effort/plan-and-suite-pass.test.mjs` (2/2) checks the plan and this scope; in a
  `git clone --depth 1` of the branch (no origin/main, no BASE_SHA) every test file under verify/plan-reader-effort/
  passed, with this one in its depth-1 mode.
