```json
{
  "id": "self-edit-check-snapshot",
  "title": "Check self-edit with a file snapshot, and run the setup tests with the thread's environment",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The no-self-edit tests run their setup.sh, hook and release.mjs commands with the thread's environment (HOME set to the test's temp home, CLAUDE* and CCP* variables removed), prove nothing was written by comparing a snapshot of every entry under the watched folders (path, type, mode, size, mtime, ctime, inode and content hash, the folder itself included) taken before and after, and run where strace is absent; strace stays available as scripts/debug/trace-writes.mjs; the copy-not-link release test drops the release tags and branches its clone inherits; and both files remove the temp folders they make.",
  "why": "On 8 Nov the no-self-edit file took 661 of the local suite's 771 seconds: it built each setup.sh environment from HOME and PATH alone, so the docs skill's npm ci lost the container's CA and proxy settings and retried for about 70 s per run, and five of its six tests skipped on CI, which has no strace. A bench of four write detectors (scratch repo, bench/selfedit) found the snapshot caught all twelve mutations while strace missed writes made through relative paths. The copy-not-link test fails in every thread container because a clone of the repo carries real release tags newer than the ones it makes (audit doc 'Where cleanup time and tokens go'; L-attention-is-the-constraint).",
  "serves": [
    "L-no-self-modification",
    "L-attention-is-the-constraint"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "verify/self-update-by-version/no-self-edit.test.mjs",
      "what": "The six tests, their stripped environments, the strace detector writesUnder and the existing snap()"
    },
    {
      "ref": "test/setup.test.mjs",
      "what": "copy-not-link: with release tags, setup installs the newest release by version"
    },
    {
      "ref": "infra/cloud-environment/setup.sh",
      "what": "Which variables it reads (CCP_SETUP_*, CLAUDE_PID) and how it picks the newest release (tags and release/ branches)"
    },
    {
      "ref": "suredesigntshirts/ccp_xstate_scratch bench/selfedit/README.md",
      "what": "The detector bench: the twelve mutations and which detector saw each; the environment timings"
    }
  ],
  "outputs": [
    {
      "ref": "verify/self-update-by-version/no-self-edit.test.mjs",
      "what": "Environment from process.env less CLAUDE* and CCP* with HOME overridden; the snapshot with inode, ctime, mode and size and a failure message naming the changed entries; the release tests snapshot the clone outside .git and HOME/.claude; no strace; temp folders removed after the file"
    },
    {
      "ref": "test/setup.test.mjs",
      "what": "The tagged copy-not-link clone deletes inherited harness-v tags and release/harness-v branches before tagging; temp folders removed after the file"
    },
    {
      "ref": "scripts/debug/trace-writes.mjs",
      "what": "strace -f a command and print its write-like syscalls under a folder; the trace file is removed unless --keep names where to put it; says it needs strace when missing"
    },
    {
      "ref": "scripts/debug/trace-writes.test.mjs",
      "what": "The builder's test of the script (skipped where strace is absent)"
    },
    {
      "ref": "CLAUDE.md",
      "what": "A Layout row for scripts/debug/"
    }
  ],
  "expect": [
    {
      "id": "env-inherited",
      "check": "Every command no-self-edit.test.mjs spawns gets the test process's environment with HOME set to the test's temp home and no variable whose name starts with CLAUDE or CCP except those the test sets itself (CCP_SETUP_LOG, CLAUDE_PID, CCP_HARNESS_*, CLAUDE_PLUGIN_ROOT and the release variables); with NODE_EXTRA_CA_CERTS and HTTPS_PROXY set in the test's environment, a setup.sh run it makes receives them",
      "how": "The verifier reads the file and runs it with a stub bash first on PATH that records its environment",
      "proof": "verifier"
    },
    {
      "id": "snapshot-detects",
      "check": "The no-self-edit snapshot reports a difference, naming the entry, for each of: a file created, a file deleted, a file's content edited, a file rewritten with its old content, a mode change, an empty folder made, a symlink retargeted, and an identical copy moved over a file; it reports none for a run that only reads the folder",
      "how": "The verifier imports or copies the snapshot and applies each mutation to a temp folder",
      "proof": "verifier"
    },
    {
      "id": "runs-without-strace",
      "check": "No test file under test/, verify/, packages/ or plugins/ spawns strace; with strace absent from PATH, no-self-edit.test.mjs runs all six tests, none skipped, and they pass",
      "how": "The verifier greps for strace and runs the file with a PATH that has no strace",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "Each no-self-edit test goes red when the code it guards writes where it says nothing is written: setup.sh replacing the plugin while a Claude runs from the same HOME, the notice hook writing a file under the plugin root, and release.mjs writing a file in the working tree outside .git",
      "how": "The verifier makes each change in a clone of the head and runs the file",
      "proof": "builder"
    },
    {
      "id": "tags-dropped",
      "check": "test/setup.test.mjs passes in a clone that carries harness-v tags newer than harness-v0.1.10 and a release/harness-v branch newer than it, and in a clone with no release tags",
      "how": "The verifier tags its own clones and runs the file in each",
      "proof": "verifier"
    },
    {
      "id": "temp-removed",
      "check": "After node --test runs no-self-edit.test.mjs or test/setup.test.mjs, passing or failing, os.tmpdir() holds no entry it did not hold before",
      "how": "The verifier lists the temp folder around each run, once with a test made to fail",
      "proof": "verifier"
    },
    {
      "id": "strace-kept",
      "check": "node scripts/debug/trace-writes.mjs <folder> -- <command> prints the write-like syscalls of the command and its children under the folder, including writes given as relative paths, exits with the command's status, leaves no trace file unless --keep <path> is given, and says strace is needed when it is missing",
      "how": "The verifier runs it on commands that write by absolute and relative path, with and without --keep, and with strace off PATH",
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
      "strace as a test's write detector (it stays a debugging script)"
    ],
    "budget": 0
  },
  "non_goals": [
    "No plugin, engine or setup.sh change, so no release",
    "Temp cleanup in other suites: verify-regression-set moves or deletes those tests",
    "No new switch in setup.sh for skipping the docs skill install",
    "The verdict for self-update-by-version keeps its record; its prose is not rewritten"
  ],
  "records": [
    "None: the tests and their CI run are the record; the PR body reports the file's local time before and after"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "Without the CA settings npm ci still fails slowly; a container whose environment lacks them would see the old time, which is a setup problem, not this test's",
    "ctime changes on any metadata write, so a test that chmods the plugin folder on purpose would need to snapshot after it"
  ]
}
```

## What this is

The 8 Nov audit of where cleanup time went found the local suite at 12m51s, 661 s of it in one file. The cause was
not strace but the environment: `runSetup` passed only `HOME` and `PATH`, so setup.sh's `npm ci` for the docs skill
lost the container's CA bundle and proxy and retried. Given the thread's environment, setup.sh takes about 2 s.

The same file proved "nothing writes the plugin" twice, with strace and with a snapshot. A bench in the scratch repo
(`bench/selfedit`, four detectors, twelve mutations) showed the snapshot with inode added catches everything strace
caught and more, runs in milliseconds, and needs no tool CI lacks. So the tests keep one detector, and strace moves
to a script for when someone needs to see which process wrote what.

The copy-not-link fix and the environment fix were noted on `verify-regression-set` by replan #188; they are this
item now, so that one stays about moving and retiring suites.

The environment keeps everything but `CLAUDE*` and `CCP*` names, because those are the thread's own session state:
`CLAUDE_PID` would point setup.sh's live-Claude guard at the thread, and `CCP_SETUP_*` would change what it installs.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Without reading the builder's tests in
`scripts/debug/`, write your own under `verify/self-edit-check-snapshot/`, one small file per Expect line, no listings:

- **env-inherited:** put a stub `bash` first on `PATH` that writes its environment to a file and runs the real bash;
  run the no-self-edit file with `NODE_EXTRA_CA_CERTS`, `HTTPS_PROXY`, a `CLAUDE_X` and a `CCP_Y` set; read what the
  stub saw.
- **snapshot-detects:** apply each mutation to a temp folder and compare snapshots before and after.
- **runs-without-strace:** grep the four trees; run the file with a `PATH` holding only links to node, git, bash and
  coreutils; read the summary for zero skips.
- **tests-bite:** break each guarded path in a clone (for example comment out setup.sh's live-Claude guard, have
  notice-behind.mjs write a file beside itself, have release.mjs write a file at the repo root), run the file, show it
  red, restore.
- **tags-dropped:** tag clones of the head as the check says and run `node --test test/setup.test.mjs` in each.
- **temp-removed:** list `os.tmpdir()` before and after each run, including one with an assertion made to fail.
- **strace-kept:** run the script as the check says.
- **ci:** read the ci and gates checks at the head sha.
