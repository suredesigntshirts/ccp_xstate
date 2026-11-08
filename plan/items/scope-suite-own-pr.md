```json
{
  "id": "scope-suite-own-pr",
  "title": "Read rules-said-once's PR scope only on its own PR",
  "stage": "s5-parity",
  "kind": "build",
  "status": "doing",
  "outcome": "verify/rules-said-once/suite-and-scope.test.mjs reads a PR's file list from git only when PR_BODY names rules-said-once by its Item: line, the way the verdict gate finds a PR's item; in any other run (a local npm test in a full clone of any branch, ci's depth-1 checkout, another item's PR) it checks the same scope from the tree, so it passes wherever rules-said-once's build holds; and rules-said-once's verdict.json is left as the verifier wrote it.",
  "why": "The suite's PR mode diffs merge-base(BASE_SHA or origin/main, HEAD)..HEAD and expects exactly rules-said-once's verify/ changes, so once that PR merged every full clone with origin/main reachable fails it: the main branch itself (an empty diff) and every other branch (its own diff). ci passes only because its depth-1 checkout falls back to tree mode. A red local suite on every branch costs each builder and verifier that runs npm test a look and a rerun (L-attention-is-the-constraint).",
  "serves": [
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "rules-said-once"
  ],
  "inputs": [
    {
      "ref": "verify/rules-said-once/suite-and-scope.test.mjs",
      "what": "The suite whose PR mode runs wherever a base is reachable"
    },
    {
      "ref": "scripts/gates/lib.mjs, .github/workflows/verdict.yml",
      "what": "namedItem, which reads a PR's item from its Item: line, and the verdict job that sets PR_BODY and BASE_SHA"
    },
    {
      "ref": "plan/decisions/2026-11-08-done-verify-edits.md",
      "what": "When a PR may change a done item's verify/ tests"
    }
  ],
  "outputs": [
    {
      "ref": "verify/rules-said-once/suite-and-scope.test.mjs",
      "what": "PR mode only when PR_BODY names rules-said-once; tree mode otherwise; the header says so"
    }
  ],
  "expect": [
    {
      "id": "full-clone-passes",
      "check": "In a full clone of the head with origin/main fetched and PR_BODY unset, node --test verify/rules-said-once/suite-and-scope.test.mjs passes and reports that it checked the scope from the tree, both at the head and at the commit origin/main points to with the head's suite file copied in; the base's suite file fails at both",
      "how": "The verifier's own test making the clones and checkouts in a temp folder and running the suite in each",
      "proof": "verifier"
    },
    {
      "id": "own-pr-reads-git",
      "check": "Run at rules-said-once's build PR head (#202's last commit, which holds its verdict) with BASE_SHA set to that PR's base and PR_BODY holding the line Item: rules-said-once, the head's suite file reads the file list from git and passes; with one more commit adding a file outside the item's outputs it fails naming that file; with PR_BODY naming another item it checks from the tree instead",
      "how": "The verifier's own test, a temp worktree at #202's last commit with the head's suite file copied in, run three ways",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only verify/rules-said-once/suite-and-scope.test.mjs and plan/items/scope-suite-own-pr.md; verify/rules-said-once/verdict.json and every other file under verify/ are left as they were at the base",
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
    "rules-said-once's verdict.json and its Expect lines stay as they are",
    "Other suites are not moved or deleted here; verify-regression-set does that, after this item"
  ],
  "records": [
    "None: the suite's own diagnostic line says which mode it ran in"
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

Found on 8 Nov after `rules-said-once` (#202) merged: `node --test verify/rules-said-once/suite-and-scope.test.mjs`
fails in this container's clone at the merge commit with "PR mode: 0 files", and on any other branch with that
branch's own files as strays. The suite's scope test was written for one PR, and its fallback order (`BASE_SHA`, then
`origin/main`, then the tree) picks git whenever a base can be found.

Options considered:

- **Key PR mode on the PR's item** (chosen). The verdict job sets `PR_BODY`, and the verdict gate finds a PR's item
  from its `Item:` line (`namedItem` in `scripts/gates/lib.mjs`). Reading PR mode only when that line names
  `rules-said-once` makes "the PR" in the Expect line mean what the gate means by it. A verifier rerunning it by hand
  sets `PR_BODY` and `BASE_SHA` as the job does.
- Key it on the branch name (`build/rules-said-once`). Branch names are for people (`plan/README.md`, "How an item
  moves"), and the verdict job's checkout has none.
- Drop PR mode. Smaller, but the suite's own Expect line, `suite-and-scope`, is about the PR's file list, and its
  verdict names this file; a later rerun on that PR should still read the list.
- Fold it into `verify-regression-set`. That item retires every done suite, this one included, but it waits for
  `verify-regression-plugin` and `test-fixture-edges`; the local suite would stay red on every branch until then.

`verify-regression-set` now waits for this item, so it moves or deletes the fixed file
(`plan/decisions/2026-11-08-parallel-deps.md`, rule 1). Editing a done item's `verify/` test in this PR follows
`plan/decisions/2026-11-08-done-verify-edits.md`.

## Verifier brief

Check out the PR at its head sha in a full clone (`git fetch --unshallow origin` if shallow, and fetch `main` so
`origin/main` exists), run `npm ci`, and read `docs/gates.md` at the head: your `verdict.json` carries `test` on every
verifier result. Without reading the builder's diff first, write your tests under `verify/scope-suite-own-pr/`. Each
run of the suite under test goes through a child `node --test` with `PR_BODY`, `BASE_SHA`, `HEAD_SHA` and
`NODE_TEST_CONTEXT` removed from its environment unless the line sets them.

- **full-clone-passes:** in temp worktrees, run the suite at the head, and at the commit `origin/main` points to with
  the head's file copied over it. Then the same with the base's file. Read the diagnostic that names the mode.
- **own-pr-reads-git:** take #202's last commit (the second parent of its merge into main) and its base (the first
  parent of that merge). In a temp worktree at that commit (it holds `verify/rules-said-once/lib.mjs`), copy the head's suite file in and run it with `BASE_SHA` and `PR_BODY="Item: rules-said-once"`;
  commit a stray file and run again; then run with `PR_BODY="Item: another-item"`. Your test must pass in ci's depth-1
  checkout too, where none of this history exists: fetch the shas it needs at depth 1, as earlier verifiers did.
- **scope:** `git diff --name-only <base> <head>`.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line at most: the command, the excerpt, the inputs to run it again.
