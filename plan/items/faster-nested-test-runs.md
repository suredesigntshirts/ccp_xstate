```json
{
  "id": "faster-nested-test-runs",
  "title": "Make the guards that run other tests, or build big fixtures, do it once and only as much as they check",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The guards flagged in the 9 Nov test speed review run the same test names with the same results, in at most 60% of their summed test time at the base: mutation checks rerun only the tests they name and assert at least one ran; nested node --test runs that differ only in environment run once; fixtures a file rebuilds per test are built once; repo copies leave out bench/, tournaments/ and node_modules; and no test leaves branches or worktrees beside the checkout or edits files in it.",
  "why": "The 9 Nov review (/mnt/project-files/test-perf-review/README.md, six readers over test code at 4f221631) found that after lean clones most of the remaining guard time is tests that run other tests: seven gates and plan files rerun all of plan-check.test.mjs or pr-gate.test.mjs three times to show a check bites (about 140 s), self-edit-check runs no-self-edit three times in environments that differ by one variable (70 to 110 s), no-self-edit's world() rebuilds its bare origin per test, stage-record reruns every tourney file, and two moved-tests-bite files copy the whole 92 MB repo. standin.test.js and bin.test.js also leave worktrees and run/it* branches beside the checkout, which breaks npm test in a worktree, and setup-install edits the real tree while other files run.",
  "serves": [
    "L-harness-overhead"
  ],
  "depends_on": [
    "regression-set-leftovers"
  ],
  "inputs": [
    {
      "ref": "/mnt/project-files/test-perf-review/README.md",
      "what": "The ranked findings, each with the per-slice report that holds file:line, fix and risk"
    },
    {
      "ref": "test/regression/plan/no-doing-status.test.mjs, test/regression/plan/lean-ready-head.test.mjs, test/regression/plan/ready-rules-named.test.mjs, test/regression/gates/build-sets-done.test.mjs, test/regression/gates/evidence-links-listings.test.mjs, test/regression/gates/verdict-cutoff.test.mjs, test/regression/gates/contract-and-verdict-tests.test.mjs",
      "what": "Mutation checks that rerun a whole test file with a check broken"
    },
    {
      "ref": "test/regression/plugin/self-edit-check.test.mjs, test/regression/plugin/no-self-edit.test.mjs",
      "what": "The nested runs of no-self-edit and its world()"
    },
    {
      "ref": "test/regression/engine/stage-record.test.mjs, test/regression/engine/moved-tests-bite.test.mjs, test/regression/plugin/moved-tests-bite.test.mjs, test/regression/engine/reminder-wake.test.mjs, test/regression/engine/bench-prompts.test.mjs, test/regression/inspector/reads-records.test.mjs",
      "what": "Nested reruns, whole-repo copies and fixtures rebuilt per test"
    },
    {
      "ref": "packages/engine/test/standin.test.js, packages/engine/test/bin.test.js, test/regression/plugin/setup-install.test.mjs",
      "what": "Tests that write beside or into the checkout"
    }
  ],
  "outputs": [
    {
      "ref": "the test files named in inputs",
      "what": "Each changed so it does its nested run or fixture once and only as wide as its check"
    },
    {
      "ref": "test/regression/lib.mjs",
      "what": "A helper for a mutation check, if two or more files share one: runs named tests of a file with a check broken, and fails if none ran"
    },
    {
      "ref": "docs/layout.md",
      "what": "The Tests section: a test that runs other tests names the ones it needs and asserts they ran; a test that copies the repo leaves out bench/, tournaments/ and node_modules; a test writes only under its temp folder"
    }
  ],
  "expect": [
    {
      "id": "same-tests",
      "check": "Every test file this PR changes runs the same test names as at the base, none skipped that ran there, and all pass",
      "how": "The verifier runs the changed files at base and head with the TAP reporter and compares",
      "proof": "verifier"
    },
    {
      "id": "still-bite",
      "check": "Each mutation check still goes red when the check it guards is broken, and fails, not passes, when its name pattern matches no test",
      "how": "The verifier breaks each guarded check in a copy and runs the mutation check; then renames its target test and runs it again",
      "proof": "verifier"
    },
    {
      "id": "no-leak",
      "check": "After the changed files run, the checkout's git status, branch list and worktree list equal what they were before, and no folder was added beside it",
      "how": "The verifier snapshots status, branches, worktrees and the parent folder, runs the files, and compares",
      "proof": "verifier"
    },
    {
      "id": "faster",
      "check": "Run alone on the same machine, the summed test time of the changed files at the head is at most 60% of the same sum at the base",
      "how": "The verifier runs the changed files at base and head, alternating, three times each, and compares medians",
      "proof": "verifier"
    },
    {
      "id": "rule-written",
      "check": "docs/layout.md's Tests section says how a test that runs other tests names them and asserts they ran, and that a repo copy leaves out bench/, tournaments/ and node_modules",
      "how": "The verifier reads the section",
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
    "merges": [
      "the per-file mutation reruns, into one way of naming the tests a mutation check needs"
    ],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No test is dropped or weakened; a finding that cannot be fixed without that is left and named in the PR",
    "No change to which files npm test runs",
    "No plugin or engine change, so no release"
  ],
  "records": [
    "The PR body and /mnt/project-files/test-perf-review/ci-times.md give each changed file's time before and after, and the ci run's time"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A name pattern that matches nothing makes a mutation check pass vacuously; still-bite checks that it fails instead",
    "Running nested runs once with a merged environment can hide a test that only failed in one of them; the builder keeps each environment's assertion"
  ]
}
```

## What this is

After lean clones, most guard time is tests that test other tests or rebuild large fixtures. Each finding in the
review is a mechanical change that keeps the test's assertion and shrinks its setup. The two that are not speed
(standin and bin leaving worktrees beside the checkout, setup-install editing the real tree) are fixed here because
they make parallel runs and worktree runs flaky.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. Write your tests under `verify/faster-nested-test-runs/`,
one small file per Expect line. Timing is noisy on a shared machine; run nothing else beside the faster runs.
