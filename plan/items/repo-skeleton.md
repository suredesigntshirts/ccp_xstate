```json
{
  "id": "repo-skeleton",
  "title": "Set up the repo so every later item has one way to test, check and find things",
  "stage": "s0-environment",
  "kind": "build",
  "status": "ready",
  "outcome": "ccp_xstate main has workspaces, node:test, CI running the tests and the plan check, a short CLAUDE.md that maps into docs/, and branch rules.",
  "why": "Every item needs the same test and CI path. A short CLAUDE.md that points into docs keeps standing knowledge checkable instead of one drifting file.",
  "serves": ["L-theory-written", "L-expect-format-one-owner", "L-count-concepts"],
  "depends_on": [],
  "inputs": [
    { "ref": "ccp_machine CLAUDE.md", "what": "Branch naming and principles to carry over" },
    { "ref": "plan/research/workflows.md", "what": "OpenAI's AGENTS.md-as-map pattern" }
  ],
  "outputs": [
    { "ref": "package.json, packages/, plugins/", "what": "npm workspaces; Node 22+, zero runtime dependencies except xstate" },
    { "ref": ".github/workflows/ci.yml", "what": "npm test and node plan/check.mjs on every PR" },
    { "ref": "CLAUDE.md", "what": "Under 100 lines: principles, branch rules, a map to docs/ and plan/" },
    { "ref": "docs/SPEC.md", "what": "Empty shell that later items fill; prose points at the workflow files" }
  ],
  "expect": [
    { "id": "ci-runs", "check": "CI runs npm test and the plan check on a PR, and fails when either fails", "how": "A PR with a deliberately broken plan item shows a red check; reverting it shows green" },
    { "id": "short-map", "check": "CLAUDE.md is under 100 lines and every path it names exists", "how": "A test in test/claude-md.test.js" },
    { "id": "branch-rule", "check": "CLAUDE.md states the branch convention without a claude/ prefix", "how": "Read it" }
  ],
  "cases": [],
  "concepts": { "adds": ["workspace layout"], "budget": 1 },
  "non_goals": ["No harness code", "No plugin yet"],
  "records": ["None; the journal does not exist yet"],
  "person_prereqs": ["Allow pushing to main for this first commit, or create main with an empty commit, since the repo has no commits"],
  "step_back": { "max_rounds": 2, "max_tokens": 1000000 },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": []
}
```

## Verifier brief

Check out the PR head. Run `npm test` and `node plan/check.mjs`. Break one plan item on a scratch branch and confirm
CI fails, then confirm the PR's own run is green. Check every path named in CLAUDE.md exists. Verdict per Expect id.
