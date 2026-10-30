```json
{
  "id": "s2-workflow-model",
  "title": "Choose how a workflow is described and picked",
  "order": 2,
  "status": "draft",
  "goal": "A workflow is a data file the person can read, change and choose per type of work, and the first workflows are chosen from what other agent harnesses do well.",
  "gate": [
    { "id": "workflow-as-data", "check": "Two different workflows exist as data files and validate against one workflow schema", "how": "Schema check in CI" },
    { "id": "chosen-with-person", "check": "The person picked the first workflow(s) from researched options", "how": "The decision item's recorded choice" }
  ]
}
```

The person's goal for v2: users modify the workflow easily and pick different workflows for different
kinds of work. v1's one fixed flow (triage, plan, build, verify, accept, land) is an input to this stage,
not its answer.
