```json
{
  "id": "fix-inspector-guard-label",
  "title": "Make the Inspector's step labels read plainly when a guard has a verb-like name",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-05",
  "module": "scripts/inspector/export.mjs",
  "outcome": "A step label the Inspector writes from a guarded transition names the guard as a quoted name, so a guard called failed reads as \"the guard \\\"failed\\\" held\" and never as \"its guard failed held\".",
  "why": "Reviewing the fail trial in the Workflow Inspector on 5 Nov, the step where verify FAILed was labelled \"The verify actor finished, and its guard failed held\", which reads as nonsense: failed is the guard's name, not a verb. labelOf in scripts/inspector/export.mjs drops the bare guard name into the sentence.",
  "serves": [
    "L-pages-current-on-demand"
  ],
  "depends_on": [
    "inspector-stage-record"
  ],
  "inputs": [
    {
      "ref": "scripts/inspector/export.mjs labelOf",
      "what": "Builds a step's label: the edge's description, else event words plus ', and its guard <name> held'"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/inspector/export.mjs labelOf",
      "what": "Quotes the guard name: ', and the guard \"<name>\" held'"
    },
    {
      "ref": "scripts/inspector/test/",
      "what": "A builder's test of the label for a guarded transition without a description"
    }
  ],
  "expect": [
    {
      "id": "label-quoted",
      "check": "Exporting the fail trial (tournaments/2026-11-04-stage-contract/trials/fail/journal) on main's engine labels step 4 (verifying to building) with the guard name in quotes, \"the guard \\\"failed\\\" held\", and no label in the bundle contains the words \"its guard\"; labels of transitions with a description are unchanged",
      "how": "The verifier's own run of export.mjs",
      "proof": "verifier"
    },
    {
      "id": "builder-test",
      "check": "The builder's test of the guarded label goes red when labelOf is reverted",
      "how": "Builder's test, broken by the verifier",
      "proof": "builder"
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
    "No change to any other label, or to the page layout",
    "No change to the engine or workflows"
  ],
  "records": [
    "The rebuilt Inspector artifact"
  ],
  "step_back": {
    "max_rounds": 1,
    "max_tokens": 200000
  },
  "verifier": "A separate subagent, using the Verifier brief below."
}
```

## What this is

A wording fix found while reviewing real runs in the Workflow Inspector on 5 Nov. Guard names in quick-fix include
`failed`, `approved` and `drop`, which read as verbs when dropped bare into a sentence.

## Verifier brief

Check out the PR at its head sha and run `npm ci`. Run `node scripts/inspector/export.mjs --engine . --journal
tournaments/2026-11-04-stage-contract/trials/fail/journal --out <tmp>` and read the labels in the bundle. Revert
labelOf and show the builder's test going red. Read the ci check at the head sha. Commit
`verify/fix-inspector-guard-label/verdict.json` with a verdict per Expect id.
