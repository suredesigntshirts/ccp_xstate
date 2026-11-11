# v1 is out of scope, and the second workflow runs the view fixes (2026-11-11)

The person's words, in the triage thread on 11 Nov:

- 06:41Z: "I want to ignore import of v1. I don't think that's important. Let's refocus on closing out the v1 party
  stuff, so we can refocus on v2."
- 06:45Z: "Could we use derive-view-gaps as a feature and kill two birds with one stone? As for ccp_machine dropping
  v1, can't we just work in here using our v1 and stop caring what happens to ccp_machine"

## What changed

- `parity-compare`, `decide-v1-retirement` and `v1-history-import` are dropped, and stage `s6-retire-v1` with them.
  No v1 numbers come into this project, and the plan no longer tracks what ccp_machine runs.
- Stage `s5-parity` loses its `measured` gate. Its new gate is that a real item runs through a workflow other than
  quick-fix.
- `second-workflow` runs the feature workflow on the work `derive-view-gaps` held, and `derive-view-gaps` is merged
  into it. The three fixes (overhead, time, rework) are natural slices for feature's slicing step, and they are the
  views that make the run's cost visible next to quick-fix's first real item.

## The one risk taken

The first real item ran in a product repo, because harness work about a harness proves less (L-first-item-is-product).
This one runs in this repo. It is taken because quick-fix has already proved v2 on product work, the change is to
`packages/journal/`, not to the plugin a session runs, and meeting this repo's gates is a test of the feature
workflow too. If the feature workflow stalls on this repo's rules, the replan says so and the fixes can still land
through quick-fix.
