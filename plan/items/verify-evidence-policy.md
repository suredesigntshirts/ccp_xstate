```json
{
  "id": "verify-evidence-policy",
  "title": "Make verifier evidence say what was shown",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A verifier commits one file per Expect line holding the command, the excerpt and the inputs to run it again; the verdict gate refuses a PR that adds a file under verify/ larger than 64 KB or named *.pass; plan/README.md and docs/gates.md state the policy.",
  "why": "Evidence was 82 percent of the lines the seven cleanups added (full journal roots, .pass listings, captures of main), and nothing read it back (decision 5; research plan/research/verification-swing.md, item 5).",
  "serves": [
    "L-contract-names-behaviour",
    "L-count-concepts"
  ],
  "depends_on": [
    "verification-contract"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 5, and decision 5. Can be built beside `verify-regression-set`;
it rules new evidence, and that item removes the old. The size limit is a two-way door: raise it in a replan if a
real verdict needs more.
