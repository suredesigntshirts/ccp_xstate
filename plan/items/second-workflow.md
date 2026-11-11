```json
{
  "id": "second-workflow",
  "title": "Run a second kind of work through a different workflow",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The fixes derive-view-gaps named run as one real item through the feature workflow, picked at filing: overhead attributes a session's tokens to the PRs whose Claude-Session trailer names it, whatever form the trailer's session takes; time counts only the person's own prompts as waiting on the person and CI results as waiting on CI; rework counts an item's readying replan against that item's build PR. The journal shows which workflow ran and who picked it, and the fixed views show what it cost next to quick-fix's first real item.",
  "why": "Different workflows for different work is the person's goal for v2, and only quick-fix has run real work. On 11 Nov the person picked feature and proposed derive-view-gaps as the item (plan/decisions/2026-11-11-v1-out-of-scope.md): its three view fixes are natural slices, and they are the views that make the run's cost visible (L-harness-overhead, L-rework-invisible). One workflow running doesn't prove the swap works.",
  "serves": [
    "L-rules-in-spec-not-host",
    "L-builder-supplies-gate-inputs",
    "L-measure-then-park",
    "L-harness-overhead",
    "L-rework-invisible"
  ],
  "depends_on": [
    "retro-first-item",
    "wf-intake",
    "refine-brief-stage"
  ],
  "inputs": [
    {
      "ref": "workflows/",
      "what": "The catalogue"
    }
  ],
  "outputs": [
    {
      "ref": "Workflow selection at filing",
      "what": "Who picked it and how, recorded with its source"
    },
    {
      "ref": "Comparison on the observe page",
      "what": "Cost and asks per workflow"
    }
  ],
  "expect": [
    {
      "id": "selected",
      "check": "The item's first engine row names its workflow and who selected it, and the builder couldn't change it",
      "how": "Rows plus a test that a builder-sent selection is refused",
      "proof": "verifier"
    },
    {
      "id": "ran",
      "check": "The item finished through its workflow's states",
      "how": "engine.transition rows",
      "proof": "verifier"
    }
  ],
  "cases": [
    "C-builder-cannot-change-own-workflow"
  ],
  "concepts": {
    "adds": [
      "workflow selection"
    ],
    "budget": 1
  },
  "non_goals": [
    "No workflow editor"
  ],
  "records": [
    "engine.transition with workflow id and hash"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 4000000
  },
  "verifier": "A separate subagent checks the two Expect lines from the journal and tries a builder-sent selection.",
  "risks": []
}
```

The item and workflow were picked on 11 Nov (`plan/decisions/2026-11-11-v1-out-of-scope.md`): feature, on the work `derive-view-gaps` held, which is
merged here. The readying replan carries that item's prose over: each bug is checked again against
`packages/journal/src/derive/`, and it says how a replan with no `Item:` line is tied to its item and which wake
reasons are the person's. The item runs in this repo, so the feature workflow's PRs meet this repo's gates; that is
part of what the run tests.
