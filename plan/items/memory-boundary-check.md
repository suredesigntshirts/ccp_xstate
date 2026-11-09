```json
{
  "id": "memory-boundary-check",
  "title": "Check that threads keep build logs out of memory once it is pruned",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "draft",
  "outcome": "After the person prunes project memory to directives and state, the next items built and verified in fresh threads leave no build or verifier log in memory, and each trap they met is in docs/traps.md or docs/verifying.md through their own PR.",
  "why": "The other three items change where learnings can go; only real threads show whether they go there (L-cheap-home-wins).",
  "serves": [
    "L-cheap-home-wins"
  ],
  "depends_on": [
    "memory-learnings-written"
  ],
  "inputs": [
    {
      "ref": "the project memory folder",
      "what": "Its files before and after the observed items"
    }
  ],
  "outputs": [
    {
      "ref": "plan/research/memory-boundary-check.md",
      "what": "What each observed thread wrote, and where"
    }
  ],
  "expect": [],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No memory deleted by a thread"
  ],
  "records": [
    "A listing of memory files per observed item, by kind"
  ],
  "person_prereqs": [
    "Prune project memory to directives and coordinator state (the audit report is the harvest)",
    "Add the project-memory line to the project instructions"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 400000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "One clean item could be luck: observe at least two"
  ]
}
```

## What this is

Draft, readied after memory-learnings-written. Pruning cannot be undone, so it is the person's step. The audit report
(`/mnt/project-files/memory-audit/report.md`) holds every learning with its source, so pruning loses nothing.
