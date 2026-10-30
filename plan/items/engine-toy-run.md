```json
{
  "id": "engine-toy-run",
  "title": "Run a toy issue through the first workflow end to end in the test project",
  "stage": "s3-engine-skeleton",
  "kind": "build",
  "status": "draft",
  "outcome": "A toy issue in a scratch repo goes from filed to merged through the person's chosen workflow, with no agent-sent lifecycle events, and the journal check reports nothing missing.",
  "why": "This is the stage gate: the walking skeleton working end to end, with real actors, before a real issue.",
  "serves": ["L-walking-skeleton-control-first", "L-build-for-next-real-item", "L-checks-against-world"],
  "depends_on": ["engine-cards-standin", "engine-item-views", "wf-choose-first"],
  "inputs": [
    { "ref": "plan/decisions/wf-choose-first.md", "what": "Which workflow" }
  ],
  "outputs": [
    { "ref": "scripts/toy-run.sh and a scratch repo issue", "what": "Repeatable toy run" },
    { "ref": "plan/research/toy-run.md", "what": "What ran, the numbers, and anything surprising" }
  ],
  "expect": [
    { "id": "merged", "check": "The toy PR is merged at the verified sha", "how": "GitHub plus the journal" },
    { "id": "complete", "check": "The journal check reports 0 missing calls and 0 unexplained merges", "how": "journal-check output" },
    { "id": "sources", "check": "Every engine.transition row's source is a wake, completion or timer", "how": "Query the rows" }
  ],
  "cases": [],
  "concepts": { "adds": [], "budget": 0 },
  "non_goals": ["Not a real issue"],
  "records": ["All of the above, for one item"],
  "person_prereqs": ["Create the scratch repo and attach it to the v2 project"],
  "step_back": { "max_rounds": 2, "max_tokens": 3000000 },
  "verifier": "A separate subagent on a different model reruns the toy run and checks the three Expect lines itself.",
  "risks": []
}
```
