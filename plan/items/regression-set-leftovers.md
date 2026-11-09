```json
{
  "id": "regression-set-leftovers",
  "title": "Keep verifier suites out of npm test, and keep the two lasting checks of the fast-clones item as guards",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-09",
  "outcome": "npm test runs no file under verify/, so a PR's ci check runs the guards (test/, scripts/, packages/, plugins/) and the verdict gate alone runs the PR's own verifier suite; the lean-clone and skills-switch checks of fast-test-clones-and-setup run on every PR as guards under test/regression/; the docs and the test that pins npm test's passes say so; and the child-after-return row of verify-regression-set's Regression table reads moved.",
  "why": "On 9 Nov CI's whole run took 9m35s after #278, and the slowest suite left in npm test was verify/verify-regression-set/moved-pass.test.mjs, which reruns all of test/regression/ twice (806 s of a 1,090 s parallel pass on #267). A verifier suite is a proof for one PR: the verdict gate (scripts/gates/pr-gate.mjs runTests) already runs the tests a verdict names at the head of that PR, so rerunning every done item's proofs on every later PR spends CI time re-proving work that no later PR touches. What should keep holding moves to test/regression/ as a guard. The person asked on 9 Nov for CI to run only what a PR needs (thread 'Find why npm test is slow in CI').",
  "serves": [
    "L-harness-overhead",
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "verify-regression-set",
    "fast-test-clones-and-setup"
  ],
  "inputs": [
    {
      "ref": "package.json",
      "what": "The test script's two passes and the globs of the parallel pass"
    },
    {
      "ref": "test/test-passes.test.mjs",
      "what": "ROOTS and the glob list it pins"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "runTests: the verdict gate runs the tests a verdict names at the PR's head"
    },
    {
      "ref": "verify/fast-test-clones-and-setup/lean-clone.test.mjs, verify/fast-test-clones-and-setup/skills-switch.test.mjs",
      "what": "The two verifier checks of lasting behaviour: a lean clone's tree, refs and HEAD, and setup.sh with and without CCP_SETUP_SKILLS=0"
    },
    {
      "ref": "plan/items/verify-regression-set.md",
      "what": "The Regression table's child-after-return row"
    },
    {
      "ref": "CLAUDE.md, docs/layout.md, docs/gates.md, .github/workflows/ci.yml",
      "what": "Every place that says npm test covers verify/"
    }
  ],
  "outputs": [
    {
      "ref": "package.json",
      "what": "The parallel pass globs test/, scripts/, packages/ and plugins/ only"
    },
    {
      "ref": "test/test-passes.test.mjs",
      "what": "Pins the four roots, and that no verify/ path is in either pass"
    },
    {
      "ref": "test/regression/plugin/lean-clone.test.mjs, test/regression/plugin/setup-skills-switch.test.mjs",
      "what": "Guards for the lean clone helper and for CCP_SETUP_SKILLS, written fresh against test/regression/lib.mjs"
    },
    {
      "ref": "CLAUDE.md, docs/layout.md, docs/gates.md, .github/workflows/ci.yml",
      "what": "npm test named as the guards; verify/ named as proofs the verdict gate runs on their own PR"
    },
    {
      "ref": "plan/items/verify-regression-set.md",
      "what": "child-after-return row reads moved"
    }
  ],
  "expect": [
    {
      "id": "no-verify-in-npm-test",
      "check": "npm test, run at the head, starts no test file under verify/, and runs every test file under test/, scripts/, packages/ and plugins/ that it ran at the base",
      "how": "The verifier runs npm test at base and head with the TAP reporter and compares the files each started",
      "proof": "verifier"
    },
    {
      "id": "verdict-gate-still-runs-proofs",
      "check": "The verdict gate, given a verdict whose lines name a test file under verify/, runs that file at the head and fails when it fails",
      "how": "The verifier runs pr-gate.mjs's verdict gate on a temp repo with a passing and a failing verify/ test named in a verdict",
      "proof": "verifier"
    },
    {
      "id": "guards-bite",
      "check": "The two new guards fail when leanClone checks out bench/ or tournaments/, when it drops a ref, and when setup.sh runs npm with CCP_SETUP_SKILLS=0 or skips it without",
      "how": "The verifier breaks each behaviour in a copy and runs the guard there",
      "proof": "verifier"
    },
    {
      "id": "docs-say-so",
      "check": "CLAUDE.md, docs/layout.md, docs/gates.md and ci.yml's step name no longer say npm test covers verify/, and docs/layout.md says where a proof that should keep holding goes",
      "how": "The verifier reads each",
      "proof": "verifier"
    },
    {
      "id": "table-row",
      "check": "verify-regression-set's Regression table row for child-after-return.test.mjs reads moved, and no other row changed",
      "how": "The verifier diffs the table between base and head",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [
      "done items' verifier suites running on every PR"
    ],
    "budget": 0
  },
  "non_goals": [
    "No verify/ folder is emptied or rewritten: the proofs stay as the record of their verdicts",
    "No change to the verdict gate",
    "No change to which guards run on a PR: that is pr-test-selection"
  ],
  "records": [
    "The PR body and /mnt/project-files/test-perf-review/ci-times.md give the ci run's time before and after"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A verify/ suite that guarded something no test/ file guards stops running; the builder lists each verify/ test file still on disk with what it checked and whether a guard covers it, in the PR body"
  ]
}
```

## What this is

A verifier's suite under `verify/<item>/` proves that item's Expect lines at its own PR's head. The verdict gate runs
the tests a verdict names there, so the proof already happens where it is needed. `npm test` also ran every done
item's suite on every later PR, which re-proves old work no later PR touched, and the slowest of them reran all of
`test/regression/` twice. This item makes `npm test` the guards only.

Two checks in `verify/fast-test-clones-and-setup/` describe behaviour other tests now rely on (the lean clone and
the setup switch), and no guard covers them, so they move to `test/regression/plugin/` as guards. The rest of that
folder checked the PR itself (same tests, faster, rule written) and stays as its proof. The child-after-return table
row is the one-word fix the verify-regression-set verifier noted. The flake note from the draft
(person-attention "rows: replaying the same wake") stays in this file for anyone who sees it again.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. Write your tests under `verify/regression-set-leftovers/`,
one small file per Expect line. For no-verify-in-npm-test, run `npm test` with `--test-reporter=tap` at base and head
(or list the files each glob expands to, if a full run is too slow, and say which). For guards-bite, break the
behaviour in a lean copy of the head and run the guard there. Read ci and gates at the head sha.
