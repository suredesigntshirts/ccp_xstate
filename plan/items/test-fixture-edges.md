```json
{
  "id": "test-fixture-edges",
  "title": "Close three test-fixture edges the self-edit check left",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The copy-not-link and no-self-edit tests pass when the checkout they run in is a detached HEAD with a local release/harness-v* branch at that very commit; scripts/debug/trace-writes.mjs --keep writes the trace where it is told even when that path is on another file system from the temp folder; and the capture hook's p95 bar, like its median bar, measures what capture adds over a bare node start measured at the same quantile, so a busy runner that slows every node start does not fail it while a capture that adds over 200 ms still does.",
  "why": "The verifier of self-edit-check-snapshot noted two edges (verdict notes 2 and 3), and ci on its verdict head failed once on capture.test.mjs's absolute 200 ms p95 (514 ms) once the no-self-edit tests stopped skipping on CI and the suite got busier (L-attention-is-the-constraint). A red that is the runner, not the harness, costs a thread a rerun and a look each time.",
  "serves": [
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "self-edit-check-snapshot"
  ],
  "inputs": [
    {
      "ref": "verify/self-edit-check-snapshot/verdict.json",
      "what": "Notes 2 (the detached HEAD clone) and 3 (EXDEV on --keep)"
    },
    {
      "ref": "test/setup.test.mjs, verify/self-update-by-version/no-self-edit.test.mjs",
      "what": "copy-not-link's release-tags test and no-self-edit's world(), which clone this checkout and delete its release refs"
    },
    {
      "ref": "scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs",
      "what": "The --keep path and its test"
    },
    {
      "ref": "plugins/harness/test/capture.test.mjs, plan/decisions/2026-10-30-capture-cheap-measures-what-capture-adds.md",
      "what": "The cheap test and why its median is read over a bare node start"
    }
  ],
  "outputs": [
    {
      "ref": "test/setup.test.mjs, verify/self-update-by-version/no-self-edit.test.mjs",
      "what": "Each clone is detached at its commit before its release refs are deleted"
    },
    {
      "ref": "scripts/debug/trace-writes.mjs",
      "what": "--keep copies the trace to the kept path, and the temp folder is removed as before"
    },
    {
      "ref": "plugins/harness/test/capture.test.mjs",
      "what": "p95 of hook.run ms minus the p95 of the bare node starts, at most 200 ms"
    },
    {
      "ref": "plan/decisions/2026-11-08-capture-p95-over-bare-start.md",
      "what": "The choice for p95, beside the 2026-10-30 one for the median"
    }
  ],
  "expect": [
    {
      "id": "detached-release-clone",
      "check": "In a clone of the head whose HEAD is detached at a commit no other branch points at, with a local branch release/harness-v9.9.9 at that same commit, node --test test/setup.test.mjs verify/self-update-by-version/no-self-edit.test.mjs passes every test, none skipped for that reason; the same run in the same kind of clone of the PR's base fails at least one copy-not-link and one no-self-edit test",
      "how": "The verifier's own test making both clones in a temp folder and running node --test in each",
      "proof": "verifier"
    },
    {
      "id": "keep-across-fs",
      "check": "With strace on PATH, trace-writes.mjs <folder> --keep <path> -- true exits 0, leaves a non-empty trace at <path> and no trace-writes-* folder in the temp dir, both when <path> is on the temp dir's file system and when it is on another one (a tmpfs or other mount whose st_dev differs from os.tmpdir()'s), and the kept trace names the command's execve",
      "how": "The verifier's own test, which finds or mounts a second file system (or points TMPDIR at one) and runs the script both ways",
      "proof": "verifier"
    },
    {
      "id": "p95-over-bare",
      "check": "Under a CPU load of twice as many busy processes as cores, capture.test.mjs's cheap test passes at the head in 5 runs out of 5; with no load, it fails at the head when the capture hook waits an extra 250 ms on PostToolUse only (the verifier adds the wait in a copy of the head), so capture's own cost still trips the bar",
      "how": "The verifier's own test running the cheap test in a copy of the head under load, and again with the extra wait; the base under the same load is recorded as an observation",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only test/setup.test.mjs, verify/self-update-by-version/no-self-edit.test.mjs, scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs, plugins/harness/test/capture.test.mjs, plan/decisions/2026-11-08-capture-p95-over-bare-start.md and plan/items/test-fixture-edges.md; no harness source under plugins/harness/ other than that test, packages/ or workflows/ changes",
      "how": "The verifier's own test reading git diff --name-only between base and head",
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
    "adds": [],
    "merges": [],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No harness source change, so no release (a test under plugins/harness/test is a test)",
    "No change to the 50 ms median bar or to obs-live-capture's Expect line; only how the test reads p95",
    "No other flaky test: one found is noted in the PR, not fixed here",
    "Other fixtures that clone this checkout are not hunted for; verify-regression-set moves or deletes those suites"
  ],
  "records": [
    "None: the tests and their CI run are the record; the PR body names the base failures it reproduced"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

Draft from the self-edit-check-snapshot verdict and its CI. Edges, each small:

- **A clone of a detached checkout.** When the source's HEAD is detached, `git clone` checks out a branch whose tip is
  that commit if there is one. A local `release/harness-v*` branch made by `release.mjs branch` at a detached checkout
  of main is such a branch, so the test clone (or the bare origin of no-self-edit's `world()`) has it as HEAD; the test
  then deletes the release refs and `git` fails with "Failed to resolve 'HEAD'". Detaching the clone's HEAD at its
  commit before deleting the refs closes it: `git checkout -q --detach` in a working clone, and
  `git update-ref --no-deref HEAD HEAD` in the bare one.
- **`--keep` across file systems.** `renameSync` out of `os.tmpdir()` fails with EXDEV when the kept path is on another
  file system. Copy, then the temp folder goes as before.
- **p95 over a bare start.** `plugins/harness/test/capture.test.mjs` compares p95 (over 5 samples, so the slowest) with
  an absolute 200 ms, while the median is read over a bare node start
  (`plan/decisions/2026-10-30-capture-cheap-measures-what-capture-adds.md`). On a busy runner every node start is slow,
  and the slowest one most, so the bar fails for the runner. Reading p95 over the p95 of the bare starts measured the
  same way keeps the bar on what capture adds.

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's diff first, write your own tests under `verify/test-fixture-edges/`:

- **detached-release-clone:** clone the head and the base into a temp folder, make an empty commit on a detached HEAD
  in each, `git branch release/harness-v9.9.9` there, link or install `node_modules`, run the two test files in each.
- **keep-across-fs:** find a mount with a different `st_dev` from `os.tmpdir()` (`/dev/shm` often is), or run with
  `TMPDIR` on one; run the script with `--keep` into the other one and into the same one.
- **p95-over-bare:** start `2 × nproc` busy loops, run the cheap test five times at the head (and at the base, as an
  observation), stop the load; then add a 250 ms wait to the PostToolUse path of `plugins/harness/scripts/capture.mjs`
  in a copy of the head and show the cheap test red. Both the hook and the bare starts are spawned with `PATH` only,
  so slowing node through `NODE_OPTIONS` reaches neither.
- **scope:** `git diff --name-only <base> <head>`.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again.
