```json
{
  "id": "fix-grant-null-repo",
  "title": "Refuse a stand-in answer on a card with no repository, whatever the grant lists",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A stand-in's answer on a card whose repository can't be read (no pr, and no github.com issue) is refused under every grant, including one whose repos list holds null, so a grant only ever covers repositories it names.",
  "why": "fix-blocked-card-grant's verifier (plan/decisions/2026-11-05-handback-after-return.md, decision 3): standinInput asks g.repos.includes(repo) with repo null when the card has no repository, so a grants file with null in repos covers every such card. main has the same gap.",
  "serves": [
    "L-standin-gap"
  ],
  "depends_on": [
    "fix-blocked-card-grant"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/standin.js",
      "what": "standinInput: cardRepo gives { repo, from }, repo null when the card has no pr and the item's issue is not a github.com issue URL; a grant matches when g.repos.includes(repo)"
    },
    {
      "ref": "verify/fix-blocked-card-grant/",
      "what": "The done suite's world (lib.mjs) drives a quick-fix item to the blocked card and answers it through bin/host.js answer with a grants file"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/standin.js",
      "what": "A grant never covers a card whose repo is null; the refusal for that grant reads as today's no-repo refusal"
    },
    {
      "ref": "packages/engine/test/standin.test.js",
      "what": "The builder's test: a grant with null in repos is refused on a no-repo card and still covers a named repository"
    }
  ],
  "expect": [
    {
      "id": "null-repo-refused",
      "check": "Through bin/host.js answer, on a quick-fix item at blocked whose issue url is not a github.com issue URL, a grant naming quick-fix, ask, the choice and repos [null] (and one with repos [null, \"o/r\"]) is refused with exit 2, the refusal says the card has no repository, and the item and its journal are unchanged",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "named-repos-unchanged",
      "check": "The grant with repos [null, \"o/r\"] still answers the blocked card of an item whose issue is https://github.com/o/r/issues/<n>, and the merge card of an item whose PR is in o/r; every engine, plugin and verify test that passes on main passes at the head",
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
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No validation of grants.json beyond this: the person writes it (plan/decisions/2026-10-31-first-grant.md)",
    "No change to where a card's repository is read from (fix-blocked-card-grant decision 1)",
    "No change to any workflow"
  ],
  "records": [
    "the refusal text naming the grant and the missing repository"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 300000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A grant written to cover no-repo cards on purpose stops working; none exists, and a card with no repository should be a tap"
  ]
}
```

## What this is

Found by fix-blocked-card-grant's verifier. `standinInput()` checks a grant's repos with `includes(repo)`, and `repo`
is null when the card has no PR and the item's issue is not a GitHub issue, so a grants file with `null` in `repos`
covers every such card. This makes "no repository" match no grant. The decision is decision 3 of
plan/decisions/2026-11-05-handback-after-return.md.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/fix-grant-null-repo/` without reading the builder's; verify/fix-blocked-card-grant/lib.mjs shows a world that
takes quick-fix to the blocked card and answers it through `bin/host.js answer` with a grants file. Cover
null-repo-refused (exit code, refusal text, item state and journal before and after) and named-repos-unchanged (the
blocked card under an o/r issue and a merge card under an o/r PR, each answered under the grant with
`[null, "o/r"]`). Run `npm test` at the head and at main and compare. Read the ci check at the head sha. This
container signs commits: commit any evidence holding commit shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit `verify/fix-grant-null-repo/verdict.json` with
a verdict per Expect id.
