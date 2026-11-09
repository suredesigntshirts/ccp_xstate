```json
{
  "id": "pr-test-selection",
  "title": "Run on a PR only the guards its changed files can reach, and every guard on main",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A PR's ci check runs the guard files whose imports, or repo paths they name, reach a file the PR changes, and all guards when the PR changes anything they all share (package.json, package-lock.json, the selector, ci.yml, test/regression/lib.mjs's dependencies) or a file the selector cannot place; a push to main runs every guard; and over the last thirty merged PRs, the selection holds every guard file whose result differs between that PR's base and head.",
  "why": "The person asked on 9 Nov that a PR not rerun guards of code it never touched (thread 'Find why npm test is slow in CI'). Most PRs here are plan-only replans or touch one package, yet each runs every guard. Running all of them on main still catches anything the selection misses, one merge later.",
  "serves": [
    "L-harness-overhead"
  ],
  "depends_on": [
    "faster-nested-test-runs"
  ],
  "inputs": [
    {
      "ref": "package.json, .github/workflows/ci.yml",
      "what": "How ci runs npm test on PRs and on main"
    },
    {
      "ref": "test/, scripts/, packages/, plugins/",
      "what": "The guard files: their relative imports and the repo paths they read or spawn"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/ci/select-tests.mjs",
      "what": "Given a base and head, prints the guard files to run, or all of them, with the reason for each"
    },
    {
      "ref": ".github/workflows/ci.yml",
      "what": "On a PR, npm test over the selected files; on main, every guard"
    },
    {
      "ref": "docs/gates.md",
      "what": "The ci row says what a PR runs and what main runs"
    }
  ],
  "expect": [
    {
      "id": "selection-holds",
      "check": "For each of the last thirty merged PRs, every guard file whose result differs between running it at that PR's base and at its head is in the selector's output for that PR",
      "how": "The verifier replays the PRs: runs each guard file at base and head and compares with the selector's output",
      "proof": "verifier"
    },
    {
      "id": "shared-runs-all",
      "check": "A change to package.json, package-lock.json, ci.yml, the selector, or a file no guard reaches and that is not under plan/, docs/, bench/, tournaments/ or verify/ selects every guard",
      "how": "The verifier runs the selector on made-up changes",
      "proof": "verifier"
    },
    {
      "id": "main-runs-all",
      "check": "ci on a push to main runs every guard file",
      "how": "The verifier reads ci.yml and the main run after merge",
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
      "test selection: the guards a PR runs, chosen from the files it changes"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "No change to the verdict gate or to which proofs it runs",
    "No change to npm test run locally: it still runs every guard"
  ],
  "records": [
    "The PR body gives, for the replayed PRs, how many guard files each would have run and the ci time saved"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A guard reads a file by a computed path the selector cannot see; the main run catches it one merge later, and the builder errs to selecting more"
  ]
}
```

## What this is

The guards are cheap per file but there are hundreds, and most PRs touch one corner. The selector follows each
guard's static imports and the repo paths it names, and maps a PR's changed files back to the guards that reach them.
When in doubt it runs everything. Main runs everything, so a miss shows on the next main run and is fixed there.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. Write your tests under `verify/pr-test-selection/`.
For selection-holds, a replay over thirty PRs is long; run the guard files in parallel and name the PRs in the evidence.
