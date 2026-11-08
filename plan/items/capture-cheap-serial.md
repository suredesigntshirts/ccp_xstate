```json
{
  "id": "capture-cheap-serial",
  "title": "Keep capture's cheap check from failing under the suite's own load",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "plugins/harness/test/capture.test.mjs's cheap test (capture adds at most 50 ms at the median and 200 ms at p95 over a bare node start per tool call) runs alone, after the parallel npm test pass, in ci and locally, so no other test file shares the machine while it measures; its bars and what they measure do not change; and every other test file still runs in the parallel pass.",
  "why": "The cheap test measures wall time, and npm test runs every file at once. It failed on main loads and on #251, a plan-only replan, with p95 348 ms against a 26 ms bare start, after verify-regression-plugin's contract change (#245) left the plugin's copy as the only holder of obs-live-capture/cheap (decision 7 of plan/decisions/2026-11-08-verify-regression-split.md). A bar that fails on load it did not cause teaches the team to re-run red CI. The choice of a serial lane over CPU time is in plan/decisions/2026-11-08-capture-cheap-serial-lane.md.",
  "serves": [
    "L-harness-overhead",
    "L-checks-against-world"
  ],
  "depends_on": [
    "verify-regression-plugin"
  ]
}
```

This draft was filed at the coordinator's request after the cheap test went red on #251. The decision file records why the
test moves to a serial lane rather than measuring CPU time. A likely build gives a timing test a name the parallel pass
skips, such as `*.timing.test.mjs`. `npm test` then runs those files after the parallel pass, with one concurrency, and
`.github/workflows/ci.yml` runs `npm test` unchanged. Decide in the replan how a timing test is named and how
`test/docs.test.mjs` or `docs/layout.md` describes the lane. Likely a small item of one or two rounds. It does not touch
`test/regression/`, so it can run beside `verify-regression-set`.
