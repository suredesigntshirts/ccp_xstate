```json
{
  "id": "trial-fail-path",
  "title": "Drive the FAIL and blocked paths with real agents",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "draft",
  "outcome": "A real-model trial on main's engine takes one item through verify FAIL, a rebuild that receives the verdict, and a PASS to merge, and a second takes a build through blocked to replanning; each report counts refusals by rule and says whether the stage prompts carried the agents through without coaching.",
  "why": "Three real-model trials of the stage contract (trial 1, trial 2 and the engine-stage-contract adopt trial) all merged on the first build, so the FAIL to rebuild loop and the blocked route have only ever been taken by scenario tests and offline probes. In the adopt trial the brief writer read the repo and defused the planted half-met line before the builder saw it, so a trap the brief writer can see does not reach verify; the issue must fail for a reason only running the code reveals, or the first build must be made to miss a line.",
  "serves": [
    "L-replan-after-second-fail",
    "L-checks-against-world"
  ],
  "depends_on": [
    "engine-stage-contract"
  ]
}
```
