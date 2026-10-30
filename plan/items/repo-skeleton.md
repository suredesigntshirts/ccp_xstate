```json
{
  "id": "repo-skeleton",
  "title": "Set up the repo so every later item has one way to test, check and find things",
  "stage": "s0-environment",
  "kind": "build",
  "status": "ready",
  "outcome": "ccp_xstate main has workspaces, node:test, CI running the tests and the plan check, a short CLAUDE.md that maps into docs/, and branch rules.",
  "why": "Every item needs the same test and CI path. A short CLAUDE.md that points into docs keeps standing knowledge checkable instead of one drifting file. Until v2 runs its own items, the plan items are built by hand, so CI is the only thing holding the verify-before-merge rule (plan-review finding 11).",
  "serves": [
    "L-count-concepts",
    "L-expect-format-one-owner",
    "L-merge-at-verified-head",
    "L-review-footer",
    "L-theory-written",
    "L-verifier-independent"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "ccp_machine CLAUDE.md",
      "what": "Branch naming and principles to carry over"
    },
    {
      "ref": "plan/research/workflows.md",
      "what": "OpenAI's AGENTS.md-as-map pattern"
    }
  ],
  "outputs": [
    {
      "ref": "package.json, packages/, plugins/",
      "what": "npm workspaces; Node 22+, zero runtime dependencies except xstate"
    },
    {
      "ref": ".github/workflows/ci.yml",
      "what": "npm test and node plan/check.mjs on every PR"
    },
    {
      "ref": "CLAUDE.md",
      "what": "Under 100 lines: principles, branch rules, a map to docs/ and plan/"
    },
    {
      "ref": ".github/workflows/verdict.yml",
      "what": "Reads the PR's reviews via REST; needs a PASS naming the head sha, ignoring the proxy's appended footer"
    }
  ],
  "expect": [
    {
      "id": "ci-runs",
      "check": "CI runs npm test and the plan check on a PR, and fails when either fails",
      "how": "A PR with a deliberately broken plan item shows a red check; reverting it shows green"
    },
    {
      "id": "branch-rule",
      "check": "CLAUDE.md states the branch convention without a claude/ prefix",
      "how": "Read it"
    },
    {
      "id": "short-map",
      "check": "CLAUDE.md is short and every path it names exists",
      "how": "Read it and list the paths"
    },
    {
      "id": "verdict-gate",
      "check": "CI fails a PR into main that has no PASS review naming its head sha from a verifier",
      "how": "A test PR without such a review shows the check red; adding one turns it green"
    }
  ],
  "cases": [],
  "concepts": {
    "adds": [
      "workspace layout",
      "verdict gate"
    ],
    "budget": 2
  },
  "non_goals": [
    "No harness code",
    "No plugin yet"
  ],
  "records": [
    "None; the journal does not exist yet"
  ],
  "person_prereqs": [
    "Allow pushing to main for this first commit, or create main with an empty commit, since the repo has no commits"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": []
}
```

## Verifier brief

Check out the PR head. Run `npm test` and `node plan/check.mjs`. Break one plan item on a scratch branch and confirm
CI fails, then confirm the PR's own run is green. Check every path named in CLAUDE.md exists. Verdict per Expect id.
