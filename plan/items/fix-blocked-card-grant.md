```json
{
  "id": "fix-blocked-card-grant",
  "title": "Let a stand-in's grant answer the blocked build card",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A stand-in session answers quick-fix's blocked card (retry, replan with a why, or drop) through bin/host.js answer under a grant, as it answers the merge cards: a card with no PR takes its repository from the item's GitHub issue, so a person away for hours can leave the clear-and-retry to a stand-in.",
  "why": "fix-blocked-retry's real run and its verifier (plan/decisions/2026-11-05-blocked-retry.md, After the build): standinInput checks a grant's repos against repoOf(run.input.pr.url), and the blocked card has no pr because no PR was opened, so every grant is refused with 'repo (none) not granted'. Only a tap answers it today. bin/host.js answer also has no way to give a why, so even a covered replan answer would fail quick-fix's replan guard.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-blocked-retry"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/standin.js",
      "what": "standinInput: repo = repoOf(run.input.pr.url); a grant covers an answer by workflow, ask id, choice, repo and until; the answer's output is { choice, by, grant }"
    },
    {
      "ref": "packages/engine/bin/host.js answer",
      "what": "Options --effect, --choice, --by, --grants; no --why"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "blocked's card input is question, choices [retry, replan, drop] and failure, with no pr; the replan guard needs event.output.why; the item's context.issue.url is the issue the item was started on"
    },
    {
      "ref": "verify/fix-blocked-retry/retry.test.mjs",
      "what": "Its 'retry-route (note)' test pins today's gap: a grant naming o/r is refused 'repo (none) not granted' on the blocked card"
    },
    {
      "ref": "plan/decisions/2026-11-05-blocked-card-grant.md",
      "what": "Where the card's repository comes from, whether a grant may name retry, and the why"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/standin.js",
      "what": "The repository an answer is checked against is the card's PR's when the card has a pr input, as today, else the repository of the item's issue when context.issue.url is a github.com issue URL, else none (refused as today); the refusal names which it read"
    },
    {
      "ref": "packages/engine/bin/host.js",
      "what": "answer takes --why <text>; a non-empty why is added to the answer's output as why"
    },
    {
      "ref": "packages/engine/test/standin.test.js",
      "what": "The builder's tests: the issue fallback, PR first, a non-GitHub issue, and the why"
    },
    {
      "ref": "packages/engine/README.md",
      "what": "answer's --why and where a card's repository comes from"
    },
    {
      "ref": "verify/fix-blocked-retry/retry.test.mjs",
      "what": "The 'retry-route (note)' test, which pinned the gap this item closes, now asserts the same grant is taken; nothing else in the done suite changes (plan/decisions/2026-11-05-blocked-card-grant.md, decision 4)"
    }
  ],
  "expect": [
    {
      "id": "blocked-card-answered",
      "check": "Through bin/host.js answer, on a quick-fix item at blocked whose issue is https://github.com/o/r/issues/<n>, with a grants file entry naming quick-fix, ask, the choice and o/r: retry moves the item to building with the same briefs and failure naming the block; replan with --why moves it to briefing with that why; drop ends it dropped; each answer row has source system standin, a ref naming the grant and the card, and output { choice, by, grant } (plus why when given)",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "refused-when-not-covered",
      "check": "On the blocked card, answer is refused (exit 2, item and journal unchanged) under a grant for another repo, a grant that does not name the choice, an expired grant, and when the item's issue url is not a github.com issue URL; a replan with no --why is refused and the item stays at blocked",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "pr-cards-unchanged",
      "check": "On the merge card of an item whose issue is in o/r and whose PR is in o/s, a grant for o/r only is refused and a grant for o/s is taken, so a card with a PR is checked against the PR's repository as on main; every engine, plugin and verify test that passes on main passes, except fix-blocked-retry's note test, changed as the outputs line says",
      "how": "The verifier's own test, and npm test at the head and at main",
      "proof": "verifier"
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
      "a card's repository from the item's issue when it has no PR"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to quick-fix.json or any workflow, so the pinned hash and the done suites' snapshots stay",
    "No grants.json is written or widened: the person sets grants (plan/decisions/2026-10-31-first-grant.md)",
    "No check that the stand-in cleared the block before retry: the engine cannot see the block; a retry that blocks again reaches replanning (fix-blocked-retry decision 3)",
    "No change to what a grant names (workflow, ask, choices, repos, until)"
  ],
  "records": [
    "the blocked card's answer row with source standin and the grant id",
    "the refusal text naming the repository read and where it came from"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "An issue in one repository may lead to a PR in another; a card with a PR is still checked against the PR's repository, so only the no-PR cards read the issue"
  ]
}
```

## What this is

Found by fix-blocked-retry's verifier. The blocked build card is the one card a stand-in most often should answer (the
block is usually a minute's work), but no grant can cover it, because a grant names repositories and the card has no
PR to name one. This item reads the repository from the item's GitHub issue when a card has no PR, and lets
`bin/host.js answer` carry a why so a stand-in's replan meets quick-fix's replan guard. The decisions are in
plan/decisions/2026-11-05-blocked-card-grant.md.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read plan/decisions/2026-11-05-blocked-card-grant.md,
and write your own tests under `verify/fix-blocked-card-grant/` without reading the builder's. Drive quick-fix through
the engine with stub agents until it reaches blocked (verify/fix-blocked-retry/lib.mjs shows a world that does), put the
card up with `bin/host.js card`, and answer it with `bin/host.js answer` and a grants file you write, as a stand-in
would: cover blocked-card-answered and refused-when-not-covered, reading the journal rows and the item's state after
each call. For pr-cards-unchanged, take an item to the merge card with an issue and a PR in different repositories and
answer it under each grant; run `npm test` at the head and at main and compare. Read the ci check at the head sha. This
container signs commits: commit any evidence holding commit shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit `verify/fix-blocked-card-grant/verdict.json`
with a verdict per Expect id.
