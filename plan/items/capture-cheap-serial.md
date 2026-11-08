```json
{
  "id": "capture-cheap-serial",
  "title": "Keep capture's cheap check from failing under the suite's own load",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-08",
  "outcome": "plugins/harness/test/capture.test.mjs's cheap test (capture adds at most 50 ms at the median and 200 ms at p95 over a bare node start per tool call) runs alone, after the parallel npm test pass, in ci and locally, so no other test file shares the machine while it measures; its bars and what they measure do not change; and every other test file still runs in the parallel pass.",
  "why": "The cheap test measures wall time, and npm test runs every file at once. It failed on main loads and on #251, a plan-only replan, with p95 348 ms against a 26 ms bare start, after verify-regression-plugin's contract change (#245) left the plugin's copy as the only holder of obs-live-capture/cheap (decision 7 of plan/decisions/2026-11-08-verify-regression-split.md). A bar that fails on load it did not cause teaches the team to re-run red CI. The choice of a serial lane over CPU time is in plan/decisions/2026-11-08-capture-cheap-serial-lane.md.",
  "serves": [
    "L-harness-overhead",
    "L-checks-against-world"
  ],
  "depends_on": [
    "verify-regression-plugin"
  ],
  "inputs": [
    {
      "ref": "package.json",
      "what": "The test script: one node --test run over test/, scripts/, packages/, plugins/ and verify/"
    },
    {
      "ref": "plugins/harness/test/capture.test.mjs",
      "what": "The cheap test, named 'cheap: hook.run rows show ...', and the tests beside it"
    },
    {
      "ref": "verify/test-fixture-edges/p95-over-bare.test.mjs, verify/verify-regression-plugin/left-reasons.test.mjs",
      "what": "Done suites that run the cheap test directly by file and name pattern, or read its name; they must keep passing unchanged"
    },
    {
      "ref": "plan/decisions/2026-11-08-capture-cheap-serial-lane.md",
      "what": "Why a serial pass and not CPU time"
    }
  ],
  "outputs": [
    {
      "ref": "package.json",
      "what": "npm test runs a parallel pass that skips every test whose name starts with 'cheap: ', then a serial pass (--test-concurrency=1) that runs only those tests, from the files that hold them"
    },
    {
      "ref": "test/test-passes.test.mjs",
      "what": "The builder's test: the two passes split the tests between them, and every test named 'cheap: ' lives in a file the serial pass runs"
    },
    {
      "ref": "docs/layout.md, docs/language.md",
      "what": "Tests: the serial pass and how a test joins it; the glossary line for serial pass"
    }
  ],
  "expect": [
    {
      "id": "runs-alone",
      "check": "npm test at the head runs the cheap test exactly once, in a node --test run that starts after the run holding every other test file has ended, runs with concurrency one and runs no other test; the earlier run reports no result for it other than skipped",
      "how": "The verifier's own test running npm test (or the test script's commands) with a reporter or a probe that records start and end of each run and of the cheap test",
      "proof": "verifier"
    },
    {
      "id": "same-bars",
      "check": "The cheap test's name and body in plugins/harness/test/capture.test.mjs are the base's: the same 50 ms median and 200 ms p95 bars over a bare node start, measured the same way",
      "how": "The verifier's own test comparing the test's source at base and head",
      "proof": "verifier"
    },
    {
      "id": "others-parallel",
      "check": "Every test file the base's npm test ran, the head's parallel pass runs, with the default concurrency, and every test the base ran passes or fails there as it did at the base, except the cheap test, which is skipped there",
      "how": "The verifier's own test comparing per-file results of the base's npm test and the head's parallel pass",
      "proof": "verifier"
    },
    {
      "id": "still-catches-slow",
      "check": "With capture busy-waiting 250 ms on one PostToolUse run, npm test at the head fails, and the failure is the cheap test's p95 bar in the serial pass",
      "how": "The verifier's own test, in a temp clone with that edit to plugins/harness/scripts/capture.mjs",
      "proof": "verifier"
    },
    {
      "id": "green-under-suite",
      "check": "npm test at the head passes the cheap test in three of three full runs on the verifier's machine, and node --test plugins/harness/test/capture.test.mjs run on its own still runs and passes the cheap test, so the done suites that run it by file still pass",
      "how": "The verifier's own test running the full suite three times and the file once, reading the cheap test's result each time",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "serial pass"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "The cheap test's bars, its name and what it measures stay as they are; hook.run rows and the journal format do not change",
    "No change to capture's code, the plugin or any done suite under verify/; no release",
    ".github/workflows/ci.yml keeps running npm test unchanged",
    "Other timing tests (such as verify/test-fixture-edges/p95-over-bare.test.mjs) are not moved; a later item can name them 'cheap: ' to join the serial pass"
  ],
  "records": [
    "None: node --test's own output shows the two runs"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 500000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

Filed at the coordinator's request after the cheap test went red on #251. The decision file records why the test
moves to a serial pass rather than measuring CPU time.

Options considered for how a test joins the serial pass:

- **By name: a test whose name starts with `cheap: `** (chosen). The parallel pass runs with
  `--test-skip-pattern="^cheap: "`, and the serial pass runs the files holding such tests with
  `--test-name-pattern="^cheap: " --test-concurrency=1`. Flags on the command line reach the runner's own child
  processes but not a `node --test` that a test starts itself, so the done suites that run capture's cheap test by
  file (`verify/test-fixture-edges/p95-over-bare.test.mjs`) still run it. The test keeps its name, which
  `verify/verify-regression-plugin/left-reasons.test.mjs` reads.
- By file, such as `*.timing.test.mjs`. Moving the test out of `capture.test.mjs` breaks the two done suites above,
  which name that file; editing a done suite needs its own reason (`plan/decisions/2026-11-08-done-verify-edits.md`).
- By an environment variable that skips it in the parallel pass. Every child `node --test` a test starts inherits
  it, so the done suites running the cheap test by file would see it skipped and fail.

The serial pass is named in `docs/language.md` and described in `docs/layout.md`, "Tests". The three entry texts
(`CLAUDE.md`, `plan/README.md`, `docs/gates.md`) are one line under their budget and stay unchanged; `CLAUDE.md`'s
`npm test` line still says what it runs. Running the serial pass after a red parallel pass would show both results,
but `&&` keeps the script one line and ci red either way.

## Verifier brief

Check out the PR at its head sha (`git fetch --unshallow origin` if shallow, and fetch the base), run `npm ci`, and
read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result, and your tests must pass
in ci's depth-1 checkout, where the base is not present (fetch the base sha at depth 1, as earlier verifiers did, or
pin what you read from it in your test). Without reading the builder's diff first, write your tests under
`verify/capture-cheap-serial/`. Each child `node --test` or `npm test` you start runs with `NODE_TEST_CONTEXT` removed
from its environment, or it reports to your runner instead of printing.

- **runs-alone:** the test script is one line in `package.json`; you may run its two commands yourself with
  `--test-reporter=tap` and read the order, or run `npm test` with a probe. Timing a full `npm test` inside a test
  takes minutes: give it a long timeout.
- **others-parallel:** compare file lists and per-test results, not counts alone; tests known to be flaky on a busy
  machine may differ, so say which and why in the evidence.
- **still-catches-slow:** `verify/test-fixture-edges/p95-over-bare.test.mjs` shows one way to make the edit in a temp
  clone.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again.
