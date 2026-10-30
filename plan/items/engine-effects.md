```json
{
  "id": "engine-effects",
  "title": "Do every outside action as a host effect: merge, post, card, timer",
  "stage": "s3-engine-skeleton",
  "kind": "build",
  "status": "ready",
  "outcome": "Merging, posting, cards and timers happen only as host effects keyed by effect id. Merge uses the GitHub merge tool at verdict.sha exactly, and any merge done another way is caught by the journal check.",
  "why": "In v1, agents called gh directly and gates parsed Bash to guess intent: 73 denials for about 4 catches. GitHub's agentic workflows make agents read-only and route writes through declared outputs. v2 does the same with host effects.",
  "serves": [
    "L-text-is-not-intent",
    "L-authenticate-facts-ok",
    "L-merge-at-verified-head",
    "L-merge-authority",
    "L-merge-without-review-flag",
    "L-effects-acked-once",
    "L-graphql-blocked"
  ],
  "depends_on": [
    "engine-host"
  ],
  "inputs": [
    {
      "ref": "PR #110 host effects",
      "what": "Prior art"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/effects/{merge,post,card,timer}.js",
      "what": "Each takes an effect row and returns an outcome row"
    }
  ],
  "expect": [
    {
      "id": "merge-at-sha",
      "check": "Merge passes expectedHeadSha equal to verdict.sha, and a moved head makes it fail without merging",
      "how": "Test with a GitHub stub"
    },
    {
      "id": "outside-merge",
      "check": "A PR merged outside the host is listed by the journal check",
      "how": "Test for case C-merge-outside-host-detected"
    },
    {
      "id": "no-bash",
      "check": "No effect runs a shell command or parses one",
      "how": "Test greps effects/ for child_process and $.process"
    },
    {
      "id": "red-ci",
      "check": "A red CI result sends the item back to building",
      "how": "Test for case C-red-ci-back-to-building"
    }
  ],
  "cases": [
    "C-merge-outside-host-detected",
    "C-red-ci-back-to-building"
  ],
  "concepts": {
    "adds": [
      "effect kinds"
    ],
    "budget": 1
  },
  "non_goals": [
    "No GitHub rulesets yet (parked until a separate verdict identity is needed)"
  ],
  "records": [
    "engine.effect with outcome"
  ],
  "person_prereqs": [
    "Allow rule: the host merges a PR at the verified head after an independent PASS and green CI"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 2000000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": []
}
```

## Verifier brief

Run the tests. Read every effect and confirm none shells out. Use a GitHub stub to move a PR's head between verdict
and merge and confirm no merge happens. Verdict per Expect id.
