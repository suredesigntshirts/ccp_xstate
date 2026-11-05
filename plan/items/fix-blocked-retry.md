```json
{
  "id": "fix-blocked-retry",
  "title": "Let a blocked build retry once the person clears the block",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "When a quick-fix build returns blocked, the card says what stopped it and offers a choice to retry the build once the person has cleared the block (for example granted a scope or pushed the commit), besides replan and drop; picking retry runs the build again with the same briefs and the block as its failure input, with no five whys and no new brief, and a real-model run of that route on main's current engine is journaled with live capture, so the Inspector shows each agent's tool calls, time and tokens.",
  "why": "In the trial-fail-path blocked trial a build was refused a push because its token lacked the workflow scope. The builder returned blocked and named the fix (grant the scope or push the commit), but quick-fix sent it to replanning, whose only choices are a replan with a written five whys, which throws the briefs away and starts over, or drop. Neither fits a block the person can clear in a minute. The same review of the real runs in the Workflow Inspector (5 Nov) found that no real-model run has used main's code since fix-rebuild-worktree, and that the trial journals kept no live capture, so no agent's tool calls, time or tokens can be shown; this item's real run closes both.",
  "serves": [
    "L-retries-look-like-bypass",
    "L-never-idle-on-person",
    "L-attribute-tokens-to-item",
    "L-checks-against-world"
  ],
  "depends_on": [
    "trial-fail-path",
    "fix-rebuild-worktree"
  ],
  "cases": [
    "C-refused-action-not-retried"
  ],
  "inputs": [
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/blocked/report.md",
      "what": "The blocked route with a real builder: push refused for the workflow scope, blocked returned with the fix named, item at replanning with replan or drop only"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "building onError sets failure and goes to replanning; replanning's ask offers replan (needs a why, clears briefs) or drop"
    },
    {
      "ref": "packages/engine/src/stages.js blockedOf",
      "what": "How a blocked result becomes the build's error text"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/adopt/driver/",
      "what": "The trial driver; it records no sessions/ capture, which is why the Inspector shows no trace for the trials"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/quick-fix.json",
      "what": "A blocked build reaches a card with a retry choice; retry goes back to building with briefs kept and the block as failure, guarded so it is offered only for a block and counts against the build limit"
    },
    {
      "ref": "tournaments/<folder>/trials/blocked-retry/",
      "what": "A real-model run on main's engine at the PR's base: blocked, the person's (or stand-in's) clear-and-retry, a rebuild, verify and merge, with sessions/ capture beside the journal and a report"
    },
    {
      "ref": "scripts/inspector/sources.json",
      "what": "The new run added as a real source, so the Inspector shows its trace, time and tokens"
    }
  ],
  "expect": [
    {
      "id": "retry-route",
      "check": "Through the engine with stub agents, a build that returns blocked reaches a card whose choices include retry; retry moves the item to building with the same briefs, failure naming the block, and no why; a second blocked build, or a block after the build limit, offers only replan and drop",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "not-blocked-unchanged",
      "check": "A verify FAIL, a red check or an actor error still reaches the replan or drop card with no retry choice, and every existing parity case still passes",
      "how": "The verifier's own test and npm test",
      "proof": "verifier"
    },
    {
      "id": "real-run-captured",
      "check": "The committed real-model run used main's engine at the PR's base (fix-rebuild-worktree included), went blocked, retry, build, verify PASS and merge, and its journal holds sessions/ capture rows bound to each model run, so the Inspector shows tool calls, time and tokens for every agent",
      "how": "The verifier reads the committed journal and builds the Inspector from it",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "retry choice on a blocked build's card"
    ],
    "budget": 1
  },
  "non_goals": [
    "No automatic retry: only a person's or stand-in's answer retries (L-retries-look-like-bypass)",
    "No change to how a build decides it is blocked",
    "No retry for verify or merge errors"
  ],
  "records": [
    "the card's answer row naming retry and who chose it",
    "the retried build's run folder with failure in its input"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

Found by reviewing the three real-model runs in the Workflow Inspector on 5 Nov. A blocked build is the one stall a
person can usually clear in a minute, but quick-fix treats it like a failed attempt. This item gives the card a third
choice, retry, offered only for a block. Its real run also covers two gaps the same review found: no real run on main's
current code, and no live capture in the trial journals. A replan to ready decides the exact states and guards, and
whether the card stays replanning's or becomes its own ask state.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/fix-blocked-retry/` without reading the builder's, driving the engine with stub agents for retry-route and
not-blocked-unchanged. For real-run-captured, read the committed journal: its first row's workflow pin, the engine
commit the report names, and sessions/ rows bound to each run's agent; build the Inspector from it with
scripts/inspector/build.mjs and confirm every model step shows tool calls, time and tokens. Read the ci check at the
head sha. Commit `verify/fix-blocked-retry/verdict.json` with a verdict per Expect id.
