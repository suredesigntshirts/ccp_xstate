```json
{
  "id": "regression-set-leftovers",
  "title": "Make the regression set's own check cheap and its table exact",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "npm test no longer runs every test/regression/ file a second time on top of running them once, and the Regression table in plan/items/verify-regression-set.md has no split row for a file whose tests all moved.",
  "why": "The verify-regression-set verifier noted both on 8 Nov without failing a line (observations in verify/verify-regression-set/verdict.json): its moved-pass suite runs all regression files at once, twice, adding about 13 minutes to npm test (806 s of a 1,090 s CI parallel pass at 9765a77, against 631 s without it; plan/decisions/2026-11-09-moved-pass-cost.md), and the child-after-return row reads split where every test moved.",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "verify-regression-set"
  ]
}
```

Draft written at the wrap-up on 8 Nov so the verify-regression-set verifier's two notes live in the plan, not in a thread.

- **Suite time.** The moved-pass suites under `verify/verify-regression-engine/`, `verify/verify-regression-plugin/` and
  `verify/verify-regression-set/` each run every `test/regression/` file, which `npm test` already runs once. The last
  one runs them twice (once with Playwright unreachable), about 13 minutes. Options: retire those suites as their
  items' outcome now holds by npm test itself, or have them run only on their own item's PR.
- **Suites done after the base.** Any item done after `verify-regression-set`'s base whose `verify/` folder still
  holds test files when that PR merges: this item retires those suites the same way, a row each in the Regression
  table and only `verdict.json` left in the folder.
- **One table row.** `verify/fix-trace-writes-clone-cwd/child-after-return.test.mjs` reads `split`; it had no left
  test, so it should read `moved`. The fix is one word in that row.
- **A flake to watch.** `test/regression/plugin/person-attention.test.mjs`, "rows: replaying the same wake does not
  double count a message in the view", went red once under the all-at-once load and green alone and on a re-run.
