```json
{
  "id": "fix-refusal-hints",
  "title": "Make each return refusal say how to fix it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Every refusal of a stage's return names the field, what was wrong, and that field's own description from the stage's output (the fix in plain words); a restated refusal names the key that differs, with the input's value and the returned value; and refusals per run are capped by the engine, after which the run fails with the refusals as its reason.",
  "why": "The person asked on 5 Nov how good the refusal messages are. They name the field and the broken rule, for example `result.pr.at does not match ^[0-9a-f]{40}$`, but not the fix the prompt already states for that field, and the restated refusal does not say which key differs. The only real-run refusal so far (the adopt trial's verify, restated) was fixed on the second try, so the messages work, but they lean on the agent re-reading its prompt. Today there is no cap on refusals per run, so an agent that cannot comply loops until it gives up.",
  "serves": [
    "L-refusals-unmeasured",
    "L-handback-without-return"
  ],
  "depends_on": [
    "engine-stage-contract"
  ]
}
```

## What this is

Draft. A replan to ready picks the cap, and decides whether the hint is the field's description verbatim or a pointer
to the Output line the agent already has.
