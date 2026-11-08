```json
{
  "id": "effort-scope-own-pr",
  "title": "Read plan-reader-effort's PR scope only on its own PR",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "verify/plan-reader-effort/plan-and-suite-pass.test.mjs reads a PR's file list from git only when PR_BODY names plan-reader-effort by its Item: line, as verify/rules-said-once/suite-and-scope.test.mjs does since scope-suite-own-pr; in any other run (a full clone of any branch, ci's depth-1 checkout, another item's PR) it checks that every output exists in the tree, so it passes wherever plan-reader-effort's build holds. docs/traps.md tells a verifier writing a scope test to read git only on its own PR, and says ci.yml checks out at depth 1.",
  "why": "The suite diffs merge-base(BASE_SHA or origin/main, HEAD)..HEAD and expects only plan-reader-effort's files, so since #212 merged every full clone of another branch fails it; two builders and a verifier lost a run to it on 8 Nov. It is the same fault scope-suite-own-pr fixed for rules-said-once, and verifiers keep writing it because nothing in the repo says how a scope test should find its PR (L-rules-live-in-the-repo, L-attention-is-the-constraint).",
  "serves": [
    "L-rules-live-in-the-repo",
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "plan-reader-effort",
    "scope-suite-own-pr"
  ],
  "inputs": [
    {
      "ref": "verify/plan-reader-effort/plan-and-suite-pass.test.mjs",
      "what": "The suite whose PR mode runs wherever a base is reachable"
    },
    {
      "ref": "verify/rules-said-once/suite-and-scope.test.mjs, scripts/gates/lib.mjs",
      "what": "The fixed suite to copy, and namedItem, which reads a PR's item from its Item: line"
    },
    {
      "ref": "plan/decisions/2026-11-08-done-verify-edits.md",
      "what": "When a PR may change a done item's verify/ tests"
    }
  ],
  "outputs": [
    {
      "ref": "verify/plan-reader-effort/plan-and-suite-pass.test.mjs",
      "what": "PR mode only when PR_BODY names plan-reader-effort; tree mode otherwise; the header says so"
    },
    {
      "ref": "docs/traps.md",
      "what": "A trap entry: a scope test that reads a PR's file list from git does so only when PR_BODY's Item: line names its item, else checks the tree; the shallow-clone entry says ci.yml checks out at depth 1"
    }
  ],
  "expect": [
    {
      "id": "full-clone-passes",
      "check": "In a full clone of the head with origin/main fetched and PR_BODY unset, node --test verify/plan-reader-effort/plan-and-suite-pass.test.mjs passes and reports tree mode, both at the head and on a temp branch from the head with one more commit outside plan-reader-effort's outputs; the base's suite file fails on that temp branch",
      "how": "The verifier's own test making the clone and branch in a temp folder and running the suite each way",
      "proof": "verifier"
    },
    {
      "id": "own-pr-reads-git",
      "check": "Run at plan-reader-effort's build PR head (#212's last commit) with BASE_SHA set to that PR's base and PR_BODY holding the line Item: plan-reader-effort, the head's suite file reads the file list from git and passes; with one more commit adding a file outside the item's outputs it fails naming that file; with PR_BODY naming another item it reports tree mode",
      "how": "The verifier's own test, a temp worktree at #212's last commit with the head's suite file copied in, run three ways",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only the two output files and plan/items/effort-scope-own-pr.md; verify/plan-reader-effort/verdict.json and its evidence are left as they were at the base",
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
    "No gate, engine, plugin or workflow change; no release",
    "plan-reader-effort's verdict.json and Expect lines stay as they are",
    "Other suites are not moved here; verify-regression-set does that"
  ],
  "records": [
    "None: the suite's own diagnostic line says which mode it ran in"
  ],
  "step_back": {
    "max_rounds": 2
  },
  "verifier": "A separate session, using the Verifier brief below."
}
```

Found on 8 Nov once `plan-reader-effort` (#212) merged: its `plan-and-suite-pass` suite fails in any full clone of a
branch other than its own, because its scope test diffs against `origin/main` whenever it can. The fix copies
`scope-suite-own-pr`'s: key PR mode on the PR's `Item:` line, the way the verdict gate finds a PR's item. Two suites
with the same fault in one day means the next verifier will write it again, so the rule goes in `docs/traps.md`, where
verifiers look for container behaviour. The CI depth correction rides along (it was round 4's; the round-3 verifier
found it), since this item edits the same entry's neighbour.

## Verifier brief

Check out the PR head in a full clone (`git fetch --unshallow origin` if needed) and run `npm ci`. Write your tests
under `verify/effort-scope-own-pr/` without reading the builder's; `verify/scope-suite-own-pr/` shows one way to make
the clones. Commit temp repos with the container's signing off (`docs/traps.md`).
