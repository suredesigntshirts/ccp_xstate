```json
{
  "id": "verdict-cutoff-at-verified-sha",
  "title": "Refuse a verdict whose item contract moved after the verified sha",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The verdict gate refuses a verdict when the item's contract (head without status and done_on, and Verifier brief) at verified_sha differs from the contract at the PR head, naming the item and the fields that moved; and a done_on, once set, changes only by a replan that says why.",
  "why": "The freeze's verdict-file cutoff sees only a PR's base and head, so a replan from main can reword a doing item's checks while its verdict lives on the build branch, and merging main back in keeps the old verdict valid against the new head; done_on left the frozen contract so done replans pass, which lets any PR move the fix budget's window (plan/decisions/2026-11-08-verification-contract-build.md).",
  "serves": [
    "L-proof-source",
    "L-verdict-is-a-test-result"
  ],
  "depends_on": [
    "verification-contract",
    "rules-said-once"
  ]
}
```

Draft from the verifier's observations on `verification-contract` (PR #189). The gap is in
`plan/decisions/2026-11-08-verification-contract-build.md`, "Gap found by the verifier", and decision 3 there.
The likely shape: `pr-gate.mjs verdict` reads `plan/items/<item>.md` at `verified_sha` and at the head and compares
`contract()` of both; a small, two-round item with the plan verifier's tests driving the gate in a temp repo.
