```json
{
  "id": "derive-view-gaps",
  "title": "Make the overhead, time and rework views count what they say",
  "stage": "s5-parity",
  "kind": "build",
  "status": "merged",
  "outcome": "derive.js overhead attributes a session's tokens to the PRs whose Claude-Session trailer names it, whatever form the trailer's session takes; derive.js time counts only the person's own prompts as waiting on the person and CI results as waiting on CI; and derive.js rework counts an item's readying replan, which names no item, against that item's build PR.",
  "why": "Merged into second-workflow 2026-11-11: the person proposed building these view fixes as the second workflow's real item, so one run proves the feature workflow and fixes the views that measure it (plan/decisions/2026-11-11-v1-out-of-scope.md). The time and token audit of 8 Nov ran the views over the cleanup series and found each one wrong in a way that hides cost: overhead attributes nothing, because a trailer's session_X never matches the journal's key; time files peer prompt wakes as the person and CI polls as wakes, so ci waiting is always 0; rework never links a replan, since replan PRs name no item. These views are how the person sees each stage's cost and flow (L-harness-overhead, L-rework-invisible).",
  "serves": [
    "L-harness-overhead",
    "L-rework-invisible"
  ],
  "depends_on": [],
  "merged_into": "second-workflow"
}
```

Draft filed from the memory audit of 9 Nov (section D), where the 8 Nov audit's findings lived only in project memory.
Each bug is checked again against `packages/journal/src/derive/` when this is readied: overhead keys sessions by
`r.session` and matches PR sessions as given; time maps the `prompt` wake reason to the person; rework links a replan
only by its item. The readied item says how a replan with no `Item:` line is tied to its item (its branch, its
changed item file), and which wake reasons are the person's.
