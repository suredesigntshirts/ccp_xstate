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

## After the first build round

Any change to workflows/quick-fix.json changes its hash, and this item's whole change is to quick-fix. Five done
items' verifier suites pin main's workflows as they were when those items were verified: four `main-prompts.json`
(and one `main-scenarios.json`) snapshots of every stage's render and every workflow's hash, and
verify/fix-waiting-wake's literal list of quick-fix's asking states. On the first build they went red (13 tests,
every difference the new hash, build.md's blocked line, or the new `blocked` state, which has the one-hour checkBack
those suites require). Those snapshots say "this item changed no prompt", which their own commit history still
proves; they are not a rule that no later item may change a workflow, or no workflow could change again.

9. **Snapshots are re-captured, assertions are not touched.** This item re-captures those evidence files from its own
   head with the script each suite names (verify/fix-refusal-hints/prompts.mjs and the scenario harness), adds
   `blocked` to load-check's quick-fix list, and changes nothing else in another item's verify/ folder. The verifier
   checks that every changed line in them is the hash, the blocked line or the blocked state. This holds only for an
   item whose Expect changes a workflow; any other item keeps them as they are
   (plan/decisions/2026-11-05-waiting-lines-owner.md).

## After the build

Build PR #141 merged at cadb67e. The verifier thread (session_01KfkB5Fss4RHv8crv6ez4m7) found all 5 Expect lines MET
at e4fd1c0 (verdict commit 61ec8f3). It used its own stub-agent tests through restore and offer, compared the
not-blocked routes with main's recorded output, and read the committed real run. Breaking the retry's `built` set, or
narrowing `blockedBuild` to `event.blocked`, turned its tests red. The real run
(tournaments/2026-11-04-stage-contract/trials/blocked-retry/) went blocked, retry, build, verify PASS and merge with
four real agents, each bound and captured by the harness's own hooks. Released as harness-v0.1.30.

Two findings, drafted as items:

- **fix-blocked-card-grant.** The blocked card has no `pr` input, so a stand-in's answer under a grant
  (`bin/host.js answer`) can't cover it: a grant names repos, and `repoOf` reads the card's `pr`. Today only a tap
  answers it, although the outcome names a stand-in's answer as a way in.
- **fix-handback-after-return.** In the real run, three of the four agents (both builds and the verify agent) had
  their final `SubagentHandback` refused `no-return`, after their `return` had already been accepted. The handback
  check doesn't see a result accepted earlier in the same turn, and the journal gains a false refusal per agent.
