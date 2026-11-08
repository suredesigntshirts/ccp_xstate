```json
{
  "id": "fix-trace-writes-clone-cwd",
  "title": "Give a traced child its parent's folder even when it is logged before its clone returns",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "scripts/debug/trace-writes.mjs",
  "outcome": "writesUnder resolves a child process's relative paths against the folder it really started in (its parent's working directory at the clone) and the chdirs it made itself, in whatever order strace -f logs the parent's clone return and the child's own calls, so a child that chdirs and makes a relative write before the line that returns its pid is still reported at the right path.",
  "why": "ci on #202 at 1af034e went red once on verify/self-edit-check-snapshot/strace-kept.test.mjs, which missed the mkdir of <folder>/sub/made. writesUnder sets a child's folder from its parent's when the parent's `clone(...) = <pid>` line is read; under strace -f that line can come as <unfinished ...> / <... clone resumed> after the child's own chdir, and then it overwrites the folder the child set. A red that is the parser's ordering bug costs a thread a rerun and a look each time (L-attention-is-the-constraint), and a debugging aid that misnames where a write landed reports a wrong fact (L-facts-from-source).",
  "serves": [
    "L-attention-is-the-constraint",
    "L-facts-from-source"
  ],
  "depends_on": [
    "self-edit-check-snapshot"
  ],
  "inputs": [
    {
      "ref": "scripts/debug/trace-writes.mjs",
      "what": "writesUnder: a pid seen for the first time gets startCwd; a clone, clone3, fork or vfork returning a pid sets that pid's folder to the caller's, whenever the return line is read"
    },
    {
      "ref": "verify/self-edit-check-snapshot/strace-kept.test.mjs",
      "what": "The real-strace test that went red: a bash subshell `(cd <folder>/sub && echo b > rel.txt && mkdir made)`, where the subshell's chdir and mkdir(\"made\") can be logged before bash's clone returns its pid; the open of rel.txt is still found through the fd strace decorates, so only the mkdir is missed"
    },
    {
      "ref": "https://github.com/suredesigntshirts/ccp_xstate/actions/runs/42471726784/job/128703828108",
      "what": "The red ci job"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/debug/trace-writes.mjs",
      "what": "A child's folder is taken from its parent's at the clone, read from the parent's folder when the child is first seen if the clone has not returned yet; a clone return never overwrites the folder of a child already seen"
    },
    {
      "ref": "scripts/debug/trace-writes.test.mjs",
      "what": "The builder's unit tests feeding writesUnder synthetic traces with the child's lines before and after the clone's return"
    }
  ],
  "expect": [
    {
      "id": "child-before-return",
      "check": "writesUnder, given a synthetic strace -f -y trace where a parent that chdir'd to <root>/p logs `clone(... <unfinished ...>`, then the child logs chdir(\"sub\") and mkdir(\"made\", 0777) = 0, and only then the parent logs `<... clone resumed>) = <child>`, reports a mkdir at <root>/p/sub/made; and, in a second trace of the same order where the child makes no chdir, reports the child's relative mkdir(\"m2\") at <root>/p/m2, not under the start folder; the same two traces at the PR's base report neither path",
      "how": "The verifier's own test importing writesUnder from scripts/debug/trace-writes.mjs at the head and at the base",
      "proof": "verifier"
    },
    {
      "id": "child-after-return",
      "check": "writesUnder, given a trace where the clone returns before the child logs anything and the parent then chdirs elsewhere before the child's first line, resolves the child's relative mkdir against the parent's folder at the clone, not the one the parent moved to; and a pid that no logged clone returned still resolves against the start folder",
      "how": "The verifier's own test importing writesUnder at the head",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs and plan/items/fix-trace-writes-clone-cwd.md",
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
    "Only the clone-ordering race: threads that share a folder (CLONE_FS), pid reuse and other strace line shapes stay as they are",
    "No change to the frozen verify/self-edit-check-snapshot suite or to --keep, which test-fixture-edges changes",
    "No harness source change, so no release"
  ],
  "records": [
    "None: the unit tests and the PR's ci run are the record"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

Filed from the red ci run on #202 at 1af034e. Under `strace -f`, a parent's `clone` that is interrupted by
another process's line is written as `clone(... <unfinished ...>` and later `<... clone resumed>) = <pid>`, and the
child may log its own calls in between. `writesUnder` joins the two halves, then sets the child's folder from the
parent's, so a `chdir` the child already made is lost and its next relative `mkdir` is reported under the parent's
folder, outside `<folder>/sub`. The race cannot be forced through the real strace, so the proof is a synthetic trace
fed to `writesUnder` in each order.

One likely shape: read the trace once for which pid each clone returned, so a child seen before its clone returns
takes its parent's folder at that moment (the parent is still inside the clone, so its folder is the one the child
inherited), and let the clone return set the folder only of a child not seen yet.

**Scheduling with test-fixture-edges.** `test-fixture-edges` (#210) changes `scripts/debug/trace-writes.mjs` (`--keep`
in `main`) and appends a test to `scripts/debug/trace-writes.test.mjs`. This item touches `writesUnder` and adds tests
in the same test file, so by `plan/decisions/2026-11-08-parallel-deps.md` (decision 2, a shared source file is a
scheduling rule, not a dependency) its build branches from main after #210 merges.

**Status.** The head is complete, but it stays `draft` here: the tests that copy `plan/` alone into a temp folder
refuse any real `ready` fix item, because its `module` is not in the copy. The build PR sets it `ready` and makes
those copies hold the live modules, as `fix-event-close-tag`'s build does; whichever merges second takes the other's
helper change from main.

## Verifier brief

Check out the PR at its head sha in a clean clone, `git fetch --unshallow origin` if shallow, and run `npm ci`.
Read `docs/gates.md` at the head: your `verdict.json` carries `test` on every verifier result. Without reading the
builder's diff first, write your own tests under `verify/fix-trace-writes-clone-cwd/`:

- **child-before-return:** write the two synthetic traces (pid lines in the `strace -f -qq -y` shape, with the
  `<unfinished ...>` and `<... clone resumed>` halves) and call `writesUnder(trace, root, start)`. For the base, read
  `scripts/debug/trace-writes.mjs` at the PR's base with `git show` into a temp file and import that; the test must
  pass in ci.yml's depth-1 checkout too, so skip only the base half there, with the reason.
- **child-after-return:** the in-order trace with the parent's chdir between the clone's return and the child's first
  line, and a pid no clone returned.
- **scope:** `git diff --name-only <base> <head>`.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again.
