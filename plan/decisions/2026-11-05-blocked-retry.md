# A blocked build's card offers retry (2026-11-05)

Item: fix-blocked-retry. Two-way doors, decided by the building thread as the person's stand-in, when the item went
ready.

## What happens today

In the trial-fail-path blocked trial (tournaments/2026-11-04-stage-contract/trials/blocked/report.md) the builder's
push was refused for the workflow scope. It returned `{ blocked: { reason } }`, naming the fix (grant the scope or push
the commit). `resultsOf()` in packages/engine/src/actors.js turned that into the build's error event,
`{ type: 'xstate.error.actor.build', error: 'build blocked: <reason>' }`, and quick-fix's `building.onError` set
`failure` and went to `replanning`, whose card asks "Replan it with a written five whys, or drop it?". A replan clears
the briefs, the PR and the counters and starts at briefing again. The build prompt (workflows/quick-fix/build.md) even
tells the builder "The item then stops for the person to replan; it is not retried."

## Decisions

1. **Its own ask state, `blocked`.** A blocked build goes to a new state `blocked`, not to `replanning`. Its card asks
   "The build is blocked, and the card says what stopped it. Clear the block, then retry the build with the same
   briefs; or replan with a written five whys; or drop it?" with choices `retry`, `replan`, `drop`, and carries
   `failure` (the block's text) as the replanning card does. `replanning` stays exactly as it is, so every route that
   reaches it today (verify FAIL with no build left, a red check with no build left, actor errors, a rejected merge)
   shows the same two choices. A state of its own keeps the guard on retry out of `replanning`'s card, whose choices
   are a literal list.
2. **The chart tells a block from other errors by a field on the event, not by parsing text.** `resultsOf()` adds
   `blocked: <reason>` to the error event it makes from a blocked result; `error` keeps today's text, so every other
   onError (and every journal written before) reads the same. A guard `blockedBuild` needs `event.blocked` present. No
   new guard operator: presence is one of spec.js's existing conditions.
3. **Retry is offered for the first build only, and counts against the build limit.** `blockedBuild` also needs
   `context.built` null: no build of this attempt has yet counted. Picking retry sets `built` to true, so when the
   retried build finishes its `rebuilt` becomes true and no rebuild is left after it, as for any second build. So a
   retried build that is blocked again, and a rebuild (after a verify FAIL or a red check) that is blocked, both go
   to `replanning` with replan and drop only. A replan resets `built`, so a fresh attempt may be retried once.
4. **Retry keeps everything else.** The retry transition goes to `building` with briefs, `why`, `issue`, `base`,
   `branch` and `pr` unchanged and `failure` still the block's text, so the build's `failure` input names the block.
   It needs no `why` (the `retry` guard is the choice alone). There is no five whys and no brief run.
5. **Only an answer retries.** Nothing retries a blocked build on its own (L-retries-look-like-bypass,
   C-refused-action-not-retried): the card's answer, a person's tap or a stand-in's answer under a grant, is the only
   way into retry. The card has the same one-hour `checkBack` timer as the other asks. Its invoke id is `ask`, like
   every other card, so a grant names it as today (`ask: "ask"`, choices including `retry`).
6. **The build prompt says what happens.** build.md's blocked line changes from "The item then stops for the person to
   replan; it is not retried" to say the person may clear the block and retry this build, replan or drop. No other
   prompt changes; the build stage has no bench (docs/prompts.md lists brief, shape and challenge), so there is no
   bench rerun.
7. **The real run is the blocked trial's world with real agents under the harness plugin.** The committed run reuses
   the trial world (local bare origin whose pre-receive hook refuses workflow changes with GitHub's text, the tourney
   fake GitHub as an HTTP server, local `npm test` as CI), so nothing leaves the machine and no setting changes. What
   changes from the trials: the model runs are real Claude agents started by the Agent tool in a headless
   `claude -p --plugin-dir plugins/harness` session with `CCP_HARNESS_DIR` at the run's harness folder, so the
   harness's own actor hooks bind each agent (agent.json), its return tool accepts each result, and live capture writes
   `sessions/` rows beside the journal. The "clear" is the stand-in removing the pre-receive hook (the stand-in for
   granting the scope), then answering `retry`. The issue changes a workflow file, so the stand-in also answers the
   CI-change card (`awaitingGates`) before the merge.
8. **Main's engine at the PR's base.** The run uses the engine and workflow of the PR's branch, whose base includes
   fix-rebuild-worktree; the report names the commit and the journal's first row pins the workflow.

## Rejected

- **A third choice on `replanning`'s card.** Its choices are a literal list, so every stall would show retry, including
  verify FAILs and red checks, which are not the person's to clear.
- **A `prefix` guard condition on `event.error`.** It parses text the agent wrote and adds an operator for one use.
- **Retrying a block on a rebuild.** It would be a third build. The item's limit is two builds per attempt.
