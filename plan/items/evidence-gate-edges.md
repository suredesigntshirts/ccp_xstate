```json
{
  "id": "evidence-gate-edges",
  "title": "Close the evidence gate's symlink and renamed-listing gaps",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The evidence gate refuses a symlink under verify/, since its blob size is the link text and not what it points at, and refuses a file under verify/ whose text is a node:test listing (TAP ok and not ok lines with a pass and fail summary) whatever its name, naming the path and the rule; plan/README.md and docs/gates.md say what the gate refuses and what stays the verifier's job.",
  "why": "The plan verifier of verify-evidence-policy found the gate measures a symlink by git cat-file -s of the link, so a link to a large file passes, and that the .pass rule is a name suffix only, so a listing saved as listing.txt under 64 KB passes (verify/verify-evidence-policy/verdict.json, observations 1 and 2).",
  "serves": [
    "L-contract-names-behaviour",
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-evidence-policy"
  ]
}
```

Draft from the plan verifier's observations on `verify-evidence-policy` (PR #197). Neither gap is reachable by
a verifier following its brief today; both let an archive back in by another route. The likely shape: `pr-gate.mjs
evidence` reads each path's mode from `git ls-tree` at the head (120000 is a link) and passes its text to
`checkEvidence`, which refuses a link and a text that reads as a test listing. Decide in the replan how a listing is
told (a share of lines matching `^(not )?ok \d+ ` and a `# pass` line is one way) so an evidence file that quotes
two lines of TAP as its excerpt still passes. A small, two-round item.
