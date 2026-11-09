```json
{
  "id": "batched-gate-reads",
  "title": "The PR gates read files at a revision in one git call, not one per file",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "scripts/gates/pr-gate.mjs reads the files a gate needs at the base and head with one git cat-file --batch call per gate instead of one git show per file, so the freeze gate on this repo's plan (117 items) runs in well under half a second where it took about 2.6 s, and the stubs gate likewise; every gate gives the same exit code and the same reasons as before for the same PR.",
  "why": "The final speed review after pr-test-selection (9 Nov) profiled npm test: the gate guards spend most of their time in the freeze gate, which spawned git show about six times per plan item. Each gate guard test builds a temp repo with the real plan and runs the gate, so about 25 s of the 56 s of CPU in scripts/gates/test and test/regression/gates was git process starts. Batching the reads keeps every check and only removes the process starts.",
  "serves": [
    "L-harness-overhead"
  ],
  "depends_on": [
    "pr-test-selection"
  ],
  "inputs": [
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "show() and the freeze and stubs gates that call it per file"
    },
    {
      "ref": "/mnt/project-files/test-perf-review/ci-times.md",
      "what": "The CI time log the result is added to"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "A batched reader under show(); freeze and stubs read their files through it in one call"
    }
  ],
  "expect": [
    {
      "id": "same-answers",
      "check": "For the same PR, the base pr-gate.mjs and the head one give the same exit code and the same printed reasons for the freeze, stubs, evidence and verdict gates, over PRs that change a done item's Expect lines, add and delete items, delete a verdict file, touch a path with a space in it, add a non-text file and add a stub under scripts/",
      "how": "The verifier builds the PRs in temp repos and runs both versions of the script",
      "proof": "verifier"
    },
    {
      "id": "faster",
      "check": "In a temp repo holding this repo's plan/ and scripts/, the freeze gate at the head takes under 0.5 s where the base version takes over 2 s, and scripts/gates/test plus test/regression/gates use less CPU than at the base",
      "how": "The verifier times both versions",
      "proof": "verifier"
    },
    {
      "id": "guards-pass",
      "check": "Every guard under scripts/gates/test and test/regression/gates passes at the head",
      "how": "The verifier runs them",
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
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No change to what any gate checks or how it words a reason",
    "No change to reader-effort.mjs or release.mjs, which read one or two files",
    "No plugin or engine change, so no release"
  ],
  "records": [
    "The PR body gives the freeze gate's time and the gate guards' CPU before and after, and the CI time goes in the log"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 400000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "git cat-file --batch prints a missing path differently from a present one; a path whose name looks like that line must still read as present, so the reader matches the whole line it asked for"
  ]
}
```

## What this is

The gates ask git for one file at a time. On a plan with over a hundred items that is hundreds of process starts per
gate run, and the gate guards run the gates dozens of times. One batched read per gate gives the same text faster.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. Write your tests under `verify/batched-gate-reads/`.
For same-answers, keep the base pr-gate.mjs beside the head one and run each against the same temp repos.
