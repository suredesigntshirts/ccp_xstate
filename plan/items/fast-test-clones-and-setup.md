```json
{
  "id": "fast-test-clones-and-setup",
  "title": "Make test clones of the repo leave out the bench runs, and let tests skip the docs skill's npm ci",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Every working clone of the repo that a test under test/, scripts/, packages/ or plugins/ makes comes from one helper that checks out the tree without bench/ and tournaments/; setup.sh skips only the docs skill's npm ci when CCP_SETUP_SKILLS=0 (still copying the skill) and is otherwise unchanged; every test that runs setup.sh sets it, except the tests of the skill install itself; docs/layout.md's Tests section names both, so new tests reuse them; and the same tests run and pass as before.",
  "why": "On 9 Nov a profile of the tests that run on every PR (test/, scripts/, packages/, plugins/ at #267's head 50295a0c, three files at a time on a four-core container) took 9m12s wall for 1,024 s of test time, with 7m28s of system time. A working clone of the repo checks out 9,793 files, 8,575 of them recorded bench runs under bench/*/runs (80 MB): 4.6 s per clone, against 0.76 s for a sparse checkout without bench/ and tournaments/. Each setup.sh run spends about 2 of its 2.5 s in the docs skill's npm ci; CCP_SETUP_FETCH=0 brings a run to 0.25 s but also skips the git fetches the setup tests need. The no-self-edit, setup and self-edit-check files make these clones and runs dozens of times, and self-edit-check (351 s) is the run's straggler (thread 'Find why npm test is slow in CI').",
  "serves": [
    "L-harness-overhead",
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "verify-regression-set"
  ],
  "inputs": [
    {
      "ref": "test/regression/plugin/no-self-edit.test.mjs",
      "what": "world(): a bare clone of the repo, then working clones of it; runSetup's environment"
    },
    {
      "ref": "test/regression/plugin/self-edit-check.test.mjs",
      "what": "cloneHead() and the setup.sh and nested node --test runs it makes in clones"
    },
    {
      "ref": "test/regression/plugin/release-clone-and-keep.test.mjs",
      "what": "The --no-hardlinks clone it runs copy-not-link and no-self-edit in"
    },
    {
      "ref": "test/setup.test.mjs, test/setup-release.test.mjs, test/regression/plugin/setup-install.test.mjs, test/regression/run/run-names.test.mjs, plugins/harness/test/helpers.mjs, plugins/harness/test/session-start.test.mjs, scripts/release/test/release.test.mjs",
      "what": "The other tests that clone the repo or run setup.sh, and the environment each gives it"
    },
    {
      "ref": "infra/cloud-environment/setup.sh",
      "what": "Step 2b, the docs skill copy and its npm ci, and the CCP_SETUP_* switches in its header"
    },
    {
      "ref": "test/regression/lib.mjs",
      "what": "Where helpers shared by two or more test files live"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression/lib.mjs",
      "what": "One exported clone helper: a working clone of a repo or of a bare clone of it, checked out sparse without bench/ and tournaments/, with the same refs, HEAD and history a plain git clone gives"
    },
    {
      "ref": "the test files named in inputs",
      "what": "Each working clone of the repo made through the helper; each setup.sh run with CCP_SETUP_SKILLS=0, except tests that assert the skill's npm install"
    },
    {
      "ref": "infra/cloud-environment/setup.sh",
      "what": "CCP_SETUP_SKILLS=0 skips the docs skill's npm ci only, still copying the skill and logging that npm was skipped; the header lists it under the tests-only switches"
    },
    {
      "ref": "docs/layout.md",
      "what": "The Tests section: a test that needs a working clone of the repo uses the helper, and a test that runs setup.sh sets CCP_SETUP_SKILLS=0 unless it tests the skill install"
    },
    {
      "ref": "docs/language.md",
      "what": "A line for the clone helper's term, if the builder names one"
    }
  ],
  "expect": [
    {
      "id": "lean-clone",
      "check": "The helper's clone of the repo holds no file under bench/ or tournaments/ on disk, holds every other tracked file, and has the same HEAD sha, branches and tags a plain git clone of the same source has",
      "how": "The verifier clones the head with the helper and with plain git clone and compares the two",
      "proof": "verifier"
    },
    {
      "id": "clones-through-helper",
      "check": "No test file under test/, scripts/, packages/ or plugins/ makes a working clone of the repo, or of a bare clone of it, except through the helper; clones of small temp repos a test builds itself may stay plain",
      "how": "The verifier reads every git clone call in those trees and follows its source",
      "proof": "verifier"
    },
    {
      "id": "skills-switch",
      "check": "setup.sh with CCP_SETUP_SKILLS=0 installs the plugin and copies the docs skill to ~/.claude/skills/documentation-downloader with no node_modules and runs no npm; without it, npm ci runs once in the copied skill folder and its node_modules is installed",
      "how": "The verifier runs setup.sh in a temp HOME both ways with a stub npm first on PATH that records its calls",
      "proof": "verifier"
    },
    {
      "id": "tests-set-switch",
      "check": "Every setup.sh run a test makes under test/, scripts/, packages/ or plugins/ has CCP_SETUP_SKILLS=0 in its environment, except runs in tests that assert the skill's npm install",
      "how": "The verifier runs those files with a stub bash first on PATH that records the environment of each setup.sh run",
      "proof": "verifier"
    },
    {
      "id": "same-tests",
      "check": "The test files this PR changes run the same test names as at the PR's base, none skipped that ran there, and all pass",
      "how": "The verifier runs the changed files at base and head and compares the names and results",
      "proof": "verifier"
    },
    {
      "id": "faster",
      "check": "Run alone on the same machine, the summed test time of no-self-edit.test.mjs, self-edit-check.test.mjs and test/setup.test.mjs at the head is at most 60% of the same sum at the base",
      "how": "The verifier runs the three files at base and head, alternating, three times each, and compares medians",
      "proof": "verifier"
    },
    {
      "id": "rule-written",
      "check": "docs/layout.md's Tests section names the clone helper and CCP_SETUP_SKILLS",
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
    "adds": [
      "the clone helper for working clones of the repo",
      "CCP_SETUP_SKILLS, a tests-only setup.sh switch"
    ],
    "merges": [
      "the per-file clone code in the setup and self-edit tests, into one helper"
    ],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "No change to which tests npm test runs, or to the checks that test other tests (mutation and nested node --test runs): those are decided after this item",
    "No change to setup.sh's behaviour in a real container: the switch is off unless a test sets it",
    "Clones of small temp repos a test builds itself stay as they are",
    "No plugin or engine change, so no release"
  ],
  "records": [
    "The PR body gives the profile before and after: the three files' summed test time run alone, and one clone's time with and without the helper"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A test that runs another test file inside its clone may need bench/ (for example a test reading bench run sets); such a clone keeps bench/ through a helper option, and the builder names it in the PR",
    "git sparse-checkout behaves differently from a full checkout for status and merges; setup.sh's clone fast-forward must still work in a sparse clone"
  ]
}
```

## What this is

The tests that run on every PR spend most of their time making the world they test in, not testing. Two costs repeat:

- **Clones.** The repo's tree is 9,793 files, and 8,575 of them are recorded bench runs. Every test that makes a working
  clone of the repo checks all of them out and deletes them again, which is where the profile's 7.5 minutes of system
  time goes. None of the setup or self-edit tests read `bench/` or `tournaments/`; `setup.sh` takes the plugin and the
  skill from git objects with `git archive`, not from the working tree.
- **The docs skill's npm ci.** `setup.sh` copies `vendor/documentation-downloader` and runs `npm ci` there on every run.
  The tests that run `setup.sh` check the plugin install, the clone fast-forward and what is written where, not the
  skill's dependencies. The existing `CCP_SETUP_FETCH=0` skips the npm step too, but it also skips the git fetches those
  tests need, so it cannot be used for this.

The fix is two reusable patterns, written into `docs/layout.md` so new tests start from them: one helper for a working
clone of the repo, and one switch that skips only the skill's npm install. A sparse checkout keeps refs, HEAD and
history identical to a plain clone, so the tests keep testing the same thing.

Options weighed: moving the bench runs out of the repo (they are the bench's committed record, read by its tests),
`git clone --depth 1` (drops the history the release tests read), and making `setup.sh` reuse an installed
`node_modules` when the lockfile is unchanged (helps only repeat runs in one HOME, and a real container runs it once).

This lands after `verify-regression-set` (#267) because the files it changes move there.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Without reading the builder's tests, write your
own under `verify/fast-test-clones-and-setup/`, one small file per Expect line, no listings:

- **lean-clone:** clone the head with the helper and with plain `git clone`; compare `git ls-files`, the files on
  disk, `git rev-parse HEAD`, `git branch -a` and `git tag`.
- **clones-through-helper:** read each `git clone` call in the four trees and follow its source to the repo or a
  temp repo the test builds.
- **skills-switch:** put a stub `npm` first on `PATH` that records its arguments; run `setup.sh` in a temp HOME with
  and without `CCP_SETUP_SKILLS=0` and with `CCP_SETUP_LOG` set; read the stub's record and the skill folder.
- **tests-set-switch:** a stub `bash` first on `PATH` that records the environment of each run whose script is
  `setup.sh`, then runs the real bash.
- **same-tests:** run each changed file at base and head with the TAP reporter and compare test names and results.
- **faster:** time the three files run alone at base and head, alternating, three runs each; compare medians.
  Timing on a shared machine is noisy; run nothing else beside it.
- **ci:** read the ci and gates checks at the head sha.
