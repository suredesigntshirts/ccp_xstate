```json
{
  "id": "fix-merge-draft-pr",
  "title": "Keep a draft PR from stalling an item at its merge",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "packages/engine/src/effects/merge.js",
  "outcome": "An item whose verified PR is a draft never reaches a merge GitHub refuses for it: either the merge ask says the PR is a draft before anyone answers, or the merge effect marks it ready at the verified sha first, and the choice is recorded.",
  "why": "second-workflow's final quick-fix child reached its merge ask on a build PR its builder had opened as a draft. The stand-in approved, GitHub refused the merge (\"Pull Request is still a draft\"), and the item went to its replan ask, whose replan answer needs a written why that no tap carries. The fixes were already verified and green.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": []
}
```

Met on 11 Nov in the second-workflow run (`plan/decisions/2026-11-11-second-workflow-run.md`).
