```json
{
  "id": "fix-blocked-retry",
  "title": "Let a blocked build retry once the person clears the block",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-05",
  "module": "packages/engine/src/actors.js",
  "outcome": "When a quick-fix build returns blocked, the item stops at a card of its own that says what stopped the build and offers retry, besides replan and drop; picking retry (a person's tap or a stand-in's answer, never on its own) runs the build again with the same briefs and the block as its failure input, with no five whys and no new brief, and counts as the attempt's second build; and a real-model run of that route on main's engine, with the agents bound and captured by the harness plugin, is committed with its sessions/ capture, so the Inspector shows each agent's tool calls, time and tokens.",
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
      "what": "building onError sets failure and goes to replanning; replanning asks replan (needs a why, clears briefs) or drop; buildsLeft is rebuilt null, and built shifts into rebuilt on each build done"
    },
    {
      "ref": "packages/engine/src/actors.js resultsOf",
      "what": "A blocked result becomes { type: 'xstate.error.actor.<invoke>', error: '<actor> blocked: <reason>' }"
    },
    {
      "ref": "packages/engine/src/spec.js holds",
      "what": "Guard conditions: presence, is, in, same, below"
    },
    {
      "ref": "workflows/quick-fix/build.md",
      "what": "The blocked output line says the item stops for the person to replan and is not retried"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/blocked/driver/",
      "what": "The trial world (local origin, pre-receive refusal, fake GitHub, npm test as CI); its agents were told to answer by final message, so no actor hook bound them and no sessions/ capture was kept"
    },
    {
      "ref": "scripts/toy-run.sh",
      "what": "How a headless claude -p session with the harness plugin starts each run with ccp-run <run> so the actor hooks bind it and capture records it"
    },
    {
      "ref": "plan/decisions/2026-11-05-blocked-retry.md",
      "what": "The states, guards, counting and real-run decisions"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js resultsOf",
      "what": "A blocked result's error event also carries blocked: <reason>; error's text is unchanged"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "building onError first tries a new state blocked under guard blockedBuild (event.blocked present, context.built null), else replanning as today; blocked invokes ask (id ask) with question, choices [retry, replan, drop] and failure, has the checkBack timer, and goes on retry (guard retry: choice retry) to building setting built true and nothing else, on replan and drop as replanning does, onError dropped; replanning unchanged"
    },
    {
      "ref": "workflows/quick-fix/build.md",
      "what": "The blocked line says the person may clear the block and retry this build, replan or drop"
    },
    {
      "ref": "packages/engine/test/",
      "what": "The builder's tests: the retry route, the second block, a block on a rebuild, and that other errors still reach replanning"
    },
    {
      "ref": "docs/journal.md",
      "what": "The blocked field on a stage's error event"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/blocked-retry/",
      "what": "The real-model run: driver, journal with sessions/ capture, run records and report.md naming the engine commit"
    },
    {
      "ref": "scripts/inspector/sources.json",
      "what": "The new run added as a real source on main's engine"
    },
    {
      "ref": "verify/",
      "what": "Done items' suites that snapshot main's workflows (evidence/main-prompts.json and main-scenarios.json in verify/fix-refusal-hints, fix-waiting-run-stall, fix-return-tool-answer and fix-waiting-lines-owner, holding renders and the quick-fix hash, and verify/fix-waiting-wake/load-check.test.mjs's list of asking states) are re-captured from this PR's head by the scripts that wrote them, and blocked is added to quick-fix's asking states; no assertion and no other evidence changes (plan/decisions/2026-11-05-blocked-retry.md, After the first build round)"
    }
  ],
  "expect": [
    {
      "id": "retry-route",
      "check": "Through the engine with stub agents (restore/offer, or bin/host.js), a first build that returns blocked reaches state blocked, whose card's choices are retry, replan and drop and whose input carries the block's text; answering retry moves the item to building with the same briefs, failure naming the block, why unchanged and no brief run; the retried build's PR then verifies and merges",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "no-second-retry",
      "check": "A retried build that is blocked again, and a rebuild after a verify FAIL or a red check that is blocked, reach replanning with replan and drop only; a retried build whose verify FAILs has no build left and reaches replanning",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "not-blocked-unchanged",
      "check": "A verify FAIL, a red check, an agent that stopped without returning (failed.json) and a briefing error reach the same states with the same cards as on main; the error event's error text for a block is main's; every engine, plugin and verify test that passes on main passes, where a done suite's main snapshot differs from main only by quick-fix's new hash, build.md's blocked line and the blocked state, re-captured as the outputs line says",
      "how": "The verifier's own test, run at the head and at main, and npm test",
      "proof": "verifier"
    },
    {
      "id": "real-run-captured",
      "check": "The committed real-model run used the PR's engine and workflow (its base includes fix-rebuild-worktree; the journal's first row pins the PR's quick-fix), and went brief, build blocked, card blocked, stand-in clears and answers retry, build, CI, verify PASS, CI-change card, merge; every model run's agent.json binds an agent the harness hooks bound, and the journal's sessions/ rows hold that agent's tool calls and its agent.finish with ms and tokens; scripts/inspector/build.mjs over sources.json shows tool calls, time and tokens for every model step of it",
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
    "No automatic retry: only a person's tap or a stand-in's answer retries (L-retries-look-like-bypass)",
    "No change to how a build decides it is blocked",
    "No retry for verify, merge or brief errors, nor for a block on a rebuild",
    "No change to the replanning card",
    "No change to research or feature, whose stages declare no blocked output"
  ],
  "records": [
    "the blocked card's answer row naming retry and who chose it",
    "the retried build's run folder with failure in its input",
    "the block on the error event (blocked) in the journal"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "Real agents under a headless claude -p may stall or hand back without returning; the run is repeated from a fresh world, and each attempt is listed in the report",
    "Headless claude -p in a cloud container inherits CLAUDE_CODE_REMOTE_SESSION_ID; the driver unsets it as toy-run.sh does, so capture names the driver session itself"
  ]
}
```

## What this is

Found by reviewing the three real-model runs in the Workflow Inspector on 5 Nov. A blocked build is the one stall a
person can usually clear in a minute, but quick-fix treats it like a failed attempt. This item sends a blocked first
build to a card of its own with a third choice, retry, which runs the same build again once the person has cleared
the block. Its real run also covers two gaps the same review found: no real run on main's current code, and no live
capture in the trial journals. The states, guards and counting are in plan/decisions/2026-11-05-blocked-retry.md.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read plan/decisions/2026-11-05-blocked-retry.md,
and write your own tests under `verify/fix-blocked-retry/` without reading the builder's. For retry-route,
no-second-retry and not-blocked-unchanged, drive quick-fix through the engine with stub agents (the tourney world in
packages/engine/test/tourney/world.js shows how: restore, offer, stub build and verify results, a fake GitHub), and
answer the cards with tap wakes or stand-in answers; run the not-blocked cases at main too and compare states, card
choices and the error text. Run `npm test`. For real-run-captured, read the committed run under
tournaments/2026-11-04-stage-contract/trials/blocked-retry/: the journal's first row's workflow pin against the
PR's quick-fix bytes, the engine commit the report names, each model run's agent.json and the sessions/ rows for that
agent (tool.call rows and an agent.finish with ms and tokens), and the transitions blocked, retry, building, merge.
Build the Inspector with `node scripts/inspector/build.mjs` and confirm every model step of the run shows tool calls,
time and tokens. Read the ci check at the head sha. This container signs commits: commit any evidence holding commit
shas with `GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit
`verify/fix-blocked-retry/verdict.json` with a verdict per Expect id.
