```json
{
  "id": "inspector-exporter-shape",
  "title": "Check the inspector draws every state and way out of the repo's workflows",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A test under test/regression/inspector/ runs scripts/inspector/export.mjs, with no run, on every workflow file under workflows/. For each file it gets one node per state (dotted path) and one edge per way out (on, after, always, onDone, and an invoke's onDone and onError), every target resolves, and the expected shape comes from a walk of the JSON that is independent of the exporter.",
  "why": "workflow-inspector's generic test 'the exporter draws every state and way out of every workflow file' drove the exporter against an independent walk. It was gated on seven workflow files, three of them in lane checkouts under /home/user/lanes, so it always skipped. verify-regression-plugin left it under the retired-path rule, and its verifier noted that the exporter-shape check was lost rather than moved (verify/verify-regression-plugin/verdict.json, observations). The repo's own four workflows are enough to run it.",
  "serves": [
    "L-facts-from-source"
  ],
  "depends_on": [
    "verify-regression-plugin"
  ]
}
```

This draft comes from the verifier's observations on `verify-regression-plugin` (PR #232). The lost test is
`verify/workflow-inspector/generic.test.mjs` at 142b5ac: it holds the independent `shape()` walk and a one-row journal
that starts the item in the workflow's initial state. A build likely keeps both and reads `workflows/*.json` in place of
the lane folders. Decide in the replan whether it is a new test file or a test in
`test/regression/inspector/item-views.test.mjs`, and which Expect line it proves: `workflow-inspector/generic`, or a new
one on this item. Likely a small item of one or two rounds.
