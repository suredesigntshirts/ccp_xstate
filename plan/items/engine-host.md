```json
{
  "id": "engine-host",
  "title": "Run a workflow file: restore, take one event from its source, run effects once, persist",
  "stage": "s3-engine-skeleton",
  "kind": "build",
  "status": "draft",
  "outcome": "The host turns each wake (GitHub event, card tap, timer, worker completion) into one event for one item, applies it to that item's workflow, runs the resulting effects exactly once by effect id, and journals the transition with its source and transition id.",
  "why": "v1 asked agents to report what happened, then checked who sent it. The host makes the machine start the work and hear results from their sources, so there is nothing to attest. PR #110 already ran this shape headlessly.",
  "serves": ["L-agents-self-report", "L-facts-from-source", "L-effects-acked-once", "L-record-route-at-write", "L-replay-facts-not-rules", "L-library-mount-slow", "L-retries-look-like-bypass", "L-no-trust-boundary"],
  "depends_on": ["probe-xstate-runtime", "wf-catalogue", "obs-live-capture"],
  "inputs": [
    { "ref": "ccp_machine PR #110 packages/orchestrator/src/{host,driver,step,journal}.js and plugins/orchestrator", "what": "The walking-skeleton host to port; it depends only on xstate" },
    { "ref": "plan/research/platform-baseline.md", "what": "Whether the host can be a mod reacting to idle wakes, or must be a thread prompted by the wake" },
    { "ref": "plan/research/xstate-runtime.md", "what": "The pinned XState version" }
  ],
  "outputs": [
    { "ref": "packages/engine/src/host.js", "what": "restore, applyEvent, runEffects, persist; one item per call" },
    { "ref": "engine.transition, engine.effect rows", "what": "With item, state, transition id, event source and effect id" }
  ],
  "expect": [
    { "id": "duplicate", "check": "The same GitHub event delivered twice, and a restart mid-effect, each produce the effect once", "how": "Test for case C-duplicate-wake-no-double-effect" },
    { "id": "stale", "check": "A completion from a replaced run is journalled as stale and changes nothing", "how": "Test for case C-stale-completion-dropped" },
    { "id": "refused-effect", "check": "A refused effect is journalled with its rule and not retried; the item steps back", "how": "Test for case C-refused-action-not-retried" },
    { "id": "replay", "check": "Replaying an item's journal rebuilds its snapshot exactly", "how": "Test compares snapshot hashes" },
    { "id": "no-agent-events", "check": "No code path lets an agent send a lifecycle event", "how": "Test: the host's event intake accepts only wake, completion and timer sources" }
  ],
  "cases": ["C-duplicate-wake-no-double-effect", "C-stale-completion-dropped", "C-refused-action-not-retried"],
  "concepts": { "adds": ["host", "effect id"], "budget": 2 },
  "non_goals": ["No spawning yet (engine-actors)", "No cards yet (engine-cards)", "One item at a time"],
  "records": ["engine.transition", "engine.effect"],
  "person_prereqs": ["Allow rules for the host's actions, in plain words, placed and rebuilt before the thread starts (exact wording comes from the probe)"],
  "step_back": { "max_rounds": 2, "max_tokens": 3000000 },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": ["Draft until the platform probe says where the host lives; the head is complete otherwise"]
}
```

## Verifier brief

Read the five cases named above first. Write your own test for each from the case text, against the host's public
functions, and run them. Then replay a recorded item journal and compare hashes. Verdict per Expect id.
