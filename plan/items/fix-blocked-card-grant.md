```json
{
  "id": "fix-blocked-card-grant",
  "title": "Let a stand-in's grant answer the blocked build card",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A stand-in session answers quick-fix's blocked card (retry, replan or drop) through bin/host.js answer under a grant, as it answers the merge cards, so a person away for hours can leave the clear-and-retry to a stand-in.",
  "why": "fix-blocked-retry's real run and its verifier (plan/decisions/2026-11-05-blocked-retry.md, After the build): standinInput checks a grant's repos against repoOf(run.input.pr.url), and the blocked card has no pr because no PR was opened, so every grant is refused with 'repo (none) not granted'. Only a tap answers it today.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-blocked-retry"
  ]
}
```

## What this is

Draft. A replan to ready decides where the card's repository comes from: the item's issue url, the clone's origin, or
a `repo` input the blocked state passes to its card. It also decides whether a grant may name `retry` at all, given
that the stand-in also has to clear the block.
