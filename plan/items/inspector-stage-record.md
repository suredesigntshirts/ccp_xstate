```json
{
  "id": "inspector-stage-record",
  "title": "Show each stage's record in the Workflow Inspector",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "For any run of the stage-contract engine, the Workflow Inspector shows each model stage's stage.json as three blocks, Instructions (each prompt piece with its source), Inputs (each with its meaning and the run that produced it) and Output (the stamped fields, each path written, what it replaced and the later runs that read it), plus a per-item data-flow strip of runs and the context paths between them; runs without stage.json render as before.",
  "why": "engine-stage-contract makes every model run write runs/<n>.<actor>/stage.json, which answers the person's four questions for each stage: what instructions it got, what data, what it returned, and where that went. A record nobody can see does not serve the person; the inspector is the page they already use to look at runs.",
  "serves": [
    "L-attention-is-the-constraint",
    "L-facts-from-source",
    "L-agents-self-report"
  ],
  "depends_on": [
    "engine-stage-contract",
    "workflow-inspector"
  ],
  "inputs": [
    {
      "ref": "local branch build/inspector-stage-record in /home/user/wi-stage (4106529, 5d36621)",
      "what": "The starting point: export.mjs puts stage.json in the run bundle with producers and readers resolved to runs, page.html shows the Stage view and the flow strip, and it already follows the record's final shape (finished, stamped, fixed/filled frames, replaced, self). Not pushed. Its tournaments/2026-11-04-stage-contract/ files land with engine-stage-contract instead"
    },
    {
      "ref": "runs/<n>.<actor>/stage.json and docs/journal.md on main",
      "what": "The stage record format, from engine-stage-contract"
    },
    {
      "ref": "scripts/inspector/",
      "what": "The generic inspector from workflow-inspector"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/inspector/",
      "what": "export.mjs and page.html showing stage.json, with tests"
    },
    {
      "ref": "docs/inspector.md",
      "what": "How to read the Stage view and the flow strip"
    }
  ],
  "expect": [
    {
      "id": "true-to-record",
      "check": "For the engine-stage-contract trial and scenarios Q1 and R1, every piece, input, producer, write, replaced value and reader the page shows equals stage.json on disk, and each producer and reader links to the run it names",
      "how": "The verifier compares the rendered DOM with the run folders",
      "proof": "verifier"
    },
    {
      "id": "flow",
      "check": "The flow strip for the trial item shows brief to build to verify with the context paths between them (briefs.builder, pr, verdict), matching the record's wrote and readBy",
      "how": "Rendered page read by the verifier",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No change to packages/ or workflows/",
    "No record for host effects or child items, which have none"
  ],
  "records": [
    "The published page and its data.js"
  ],
  "step_back": {
    "max_rounds": 3
  },
  "verifier": "A separate session, using a Verifier brief written when this item turns ready.",
  "risks": [
    "The branch was written against the lane's record; any change engine-stage-contract makes to the format on its way to main must be followed here."
  ]
}
```

The work exists: local branch `build/inspector-stage-record` in `/home/user/wi-stage`, two commits on top of the
tournament record (4106529 adds the Stage view and flow strip; 5d36621 follows the record's final shape). It was
written against lane S runs from the scratch repo. Once engine-stage-contract lands, rebase it onto main, drop its
tournament-folder files (they arrive with engine-stage-contract), point its sources at main's runs, and write the
Verifier brief before turning this item ready.
