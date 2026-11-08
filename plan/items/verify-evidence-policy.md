```json
{
  "id": "verify-evidence-policy",
  "title": "Make verifier evidence say what was shown",
  "stage": "s5-parity",
  "kind": "build",
  "status": "doing",
  "outcome": "A verifier commits one file per Expect line holding the command, the excerpt and the inputs to run it again; the verdict gate refuses a PR that adds a file under verify/ larger than 64 KB or named *.pass; plan/README.md and docs/gates.md state the policy.",
  "why": "Evidence was 82 percent of the lines the seven cleanups added (full journal roots, .pass listings, captures of main), and nothing read it back (decision 5; research plan/research/verification-swing.md, item 5).",
  "serves": [
    "L-contract-names-behaviour",
    "L-count-concepts"
  ],
  "depends_on": [
    "verification-contract"
  ],
  "inputs": [
    {
      "ref": "plan/research/verification-swing.md",
      "what": "Read this first; item 5 in the items table"
    },
    {
      "ref": "plan/decisions/2026-11-08-verification-swing.md",
      "what": "Decision 5, the evidence rule; decision 2, what a verdict result carries"
    },
    {
      "ref": "plan/decisions/2026-11-08-verify-evidence-policy.md",
      "what": "The stand-in choices this item is built to: its own gate step, added and changed files, the limit in bytes, the evidence folder"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/, .github/workflows/verdict.yml",
      "what": "The pure checks, the git-reading wrapper, the gate tests and the gates job the new step joins"
    },
    {
      "ref": "verify/verification-contract/evidence/",
      "what": "Eight small evidence files, one per Expect line: the shape the policy writes down"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/gates/lib.mjs",
      "what": "checkEvidence: given the files a PR adds or changes under verify/ with their sizes, refuses each one larger than 64 KB (65,536) and each whose name ends in .pass, naming the path and, for size, how large it is"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "An evidence gate: reads the files the PR adds, changes or renames under verify/ between the merge base and the head, with their sizes at the head, and runs checkEvidence; deleted files are not read"
    },
    {
      "ref": ".github/workflows/verdict.yml",
      "what": "A step in the gates job that runs node scripts/gates/pr-gate.mjs evidence on every PR"
    },
    {
      "ref": "plan/README.md",
      "what": "How slop is kept out: evidence is one file per Expect line under verify/<item>/evidence/, holding the command, the excerpt and the inputs to run it again; no listing, journal root or capture of main; the gate refuses a file over 64 KB or named .pass"
    },
    {
      "ref": "docs/gates.md",
      "what": "The gate table gains the evidence step; a section on evidence states the same policy and that existing evidence is removed by the regression-set work, not by this gate"
    },
    {
      "ref": "docs/language.md",
      "what": "A Plan context line for evidence file"
    },
    {
      "ref": "scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "The builder's tests: a file over the limit refused with its size named, one at the limit passed, a .pass file refused at any size, a file outside verify/ ignored; the gate in a temp repo refusing an added and a grown file and passing a deletion"
    }
  ],
  "expect": [
    {
      "id": "evidence-refused",
      "check": "In a temp git repo holding a copy of the head with a PR-shaped branch, node scripts/gates/pr-gate.mjs evidence exits 1 and names the path and its size for a PR that adds a file under verify/ larger than 64 KB, exits 1 and names the path for a PR that adds a small file under verify/ whose name ends in .pass, and exits 1 for a PR that grows a small file already under verify/ past 64 KB; it exits 0 for a PR that adds a 64 KB or smaller evidence file under verify/<item>/evidence/, for one that adds a file larger than 64 KB outside verify/, and for one that deletes a large file and a .pass file already under verify/",
      "how": "The verifier's own tests building the temp repo and running the evidence gate with BASE_SHA set",
      "proof": "verifier"
    },
    {
      "id": "policy-written",
      "check": "plan/README.md's How slop is kept out and docs/gates.md each state that a verifier commits one evidence file per Expect line holding the command, the excerpt and the inputs to run it again, with no listing, journal root or capture of main, and that the evidence gate refuses a file under verify/ over 64 KB or named .pass; docs/gates.md's gate table lists the evidence step; docs/language.md defines evidence file in the Plan context",
      "how": "The verifier reads the three files",
      "proof": "verifier"
    },
    {
      "id": "gate-wired",
      "check": "The gates job in .github/workflows/verdict.yml runs node scripts/gates/pr-gate.mjs evidence as a step that runs even when an earlier step failed, and the evidence gate passes on this PR at its head, verdict and evidence included",
      "how": "The verifier reads the workflow and runs the gate on the PR's own branch",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "scripts/gates/test/lib.test.mjs goes red when checkEvidence stops refusing files over the limit, and again when it stops refusing .pass files; green again when restored",
      "how": "The verifier breaks each rule in turn and runs the named test file",
      "proof": "builder"
    },
    {
      "id": "plan-passes",
      "check": "node plan/check.mjs passes at the head; the PR changes only the files the outputs name, its own plan item and verify/verify-evidence-policy/, and no verify/ folder of another item",
      "how": "The verifier runs the plan check and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "world-refuses",
      "check": "A throwaway PR in ccp_xstate based on the head (title starting throwaway:, closed unmerged) that adds a file named listing.pass and a file larger than 64 KB under verify/ fails the verdict check on GitHub at its evidence step, and the step's log names both files",
      "how": "The PR and its verdict run on GitHub",
      "proof": "world"
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
      "evidence file (what a plan verifier commits for one Expect line: the command, the excerpt and the inputs to run it again)"
    ],
    "merges": [],
    "removes": [
      "the .pass listing and the archived capture as kinds of evidence"
    ],
    "budget": 1
  },
  "non_goals": [
    "No existing evidence is removed or moved: that is verify-regression-set",
    "The gate does not check that each Expect line has an evidence file, or what the file says; the verifier writes it and the verdict names the test",
    "No plugin or engine change, so no release",
    "The verify model stage and workflows/quick-fix/verify.md are untouched",
    "No done item's head, Verifier brief or verify/ folder changes"
  ],
  "records": [
    "The evidence gate's refusal text, in the verdict run's log, naming each file and its size"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "verify-regression-set runs beside this item and deletes files under verify/; the gate reads only added, changed and renamed files, so a deletion never trips it",
    "A real verdict may one day need more than 64 KB in one file; the limit is a two-way door, raised by a replan"
  ]
}
```

## What this is

The seven design-books cleanups added 34,865 lines, and 82 percent of them were verifier evidence: full journal
roots, `.pass` listings and captures of main (`plan/research/verification-swing.md`). Nothing read that evidence
back, and the archives are what made each later item conserve the earlier ones. Decision 5 of
`plan/decisions/2026-11-08-verification-swing.md` says evidence is what was shown: per Expect line, one file holding
the command, the excerpt and the inputs needed to run it again. This item writes that rule into `plan/README.md` and
`docs/gates.md` and gives the verdict workflow a step that refuses the two shapes that can be told by machine: a
file over 64 KB and a `.pass` listing.

The rule rules new evidence only. Existing evidence (31 files over 64 KB and 10 `.pass` files under `verify/` when
this was readied) is removed by `verify-regression-set`, which is built beside this item; this gate reads only the
files a PR adds, changes or renames, so a PR deleting them passes. The verifier of `verification-contract` already
wrote evidence in the new shape (`verify/verification-contract/evidence/`), and that folder is the model.

The stand-in choices behind the head are in `plan/decisions/2026-11-08-verify-evidence-policy.md`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: your
`verdict.json` carries `test` on every verifier and builder result, and the gate runs them. Without reading the
builder's tests, write your own under `verify/verify-evidence-policy/`:

- **evidence-refused:** make a temp git repo from the head, commit a base, then for each case a branch as a PR
  would, and run `BASE_SHA=<base> node scripts/gates/pr-gate.mjs evidence` from it. Cases: add a 70 KB file under
  `verify/x/`; add a one-line `verify/x/listing.pass`; grow a small committed `verify/x/notes.md` past 64 KB; add a
  file of exactly 64 KB under `verify/x/evidence/`; add a 200 KB file under `docs/`; delete a large and a `.pass`
  file committed at the base. Check exit codes and that the output names the paths and the size.
- **policy-written:** read `plan/README.md`, `docs/gates.md` and `docs/language.md`.
- **gate-wired:** read `.github/workflows/verdict.yml`; run the evidence gate on the PR's own branch against
  its base, with your verdict and evidence committed.
- **tests-bite:** remove the size rule from `checkEvidence`, run `node --test scripts/gates/test/lib.test.mjs`,
  show red, restore; do the same for the `.pass` rule.
- **plan-passes:** `node plan/check.mjs` at the head; read the diff's file list.
- **world-refuses:** from the head, push a throwaway branch adding `verify/x/listing.pass` and a 70 KB file under
  `verify/x/`, open a PR titled "throwaway: ...", read its verdict run's evidence step, close it unmerged.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line under `verify/verify-evidence-policy/evidence/`: the command, the
excerpt, and the inputs to run it again. No listings, no journal roots.
