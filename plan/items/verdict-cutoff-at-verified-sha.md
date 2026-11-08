```json
{
  "id": "verdict-cutoff-at-verified-sha",
  "title": "Refuse a verdict whose item contract moved after the verified sha",
  "stage": "s5-parity",
  "kind": "build",
  "status": "doing",
  "outcome": "The verdict gate refuses a verdict when the item's contract (head without status and done_on, and Verifier brief) at verified_sha differs from the contract at the PR head, naming the item and the fields that moved; and the freeze gate refuses a PR that changes a set done_on unless it is a plan-only replan whose item gains or rewrites a ## Done on change section saying why.",
  "why": "The freeze's verdict-file cutoff sees only a PR's base and head, so a replan from main can reword a doing item's checks while its verdict lives on the build branch, and merging main back in keeps the old verdict valid against the new head; done_on left the frozen contract so done replans pass, which lets any PR move the fix budget's window (plan/decisions/2026-11-08-verification-contract-build.md).",
  "serves": [
    "L-proof-source",
    "L-verdict-is-a-test-result"
  ],
  "depends_on": [
    "verification-contract",
    "rules-said-once"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-verification-contract-build.md",
      "what": "Decision 3 (done_on outside the contract) and the gap the verifier found"
    },
    {
      "ref": "plan/decisions/2026-11-08-verdict-cutoff.md",
      "what": "The stand-in choices this item is built to: the cutoff in the verdict gate, the done_on rule in the freeze, the docs"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/",
      "what": "contract(), checkFreeze, the verdict gate's verified_sha handling, and the gate tests"
    },
    {
      "ref": "docs/gates.md",
      "what": "The verdict checks and The contract freeze, which gain one sentence each"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/gates/lib.mjs",
      "what": "contractMoves(before, after): the head fields whose values differ, outside status and done_on, plus Verifier brief when it differs; checkDoneOn: refuses a changed or removed done_on that was set at the base unless the PR is a plan-only replan whose item's ## Done on change section differs from the base's"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "The verdict gate reads plan/items/<item>.md at verified_sha and refuses when contractMoves finds a field, naming the item, the short sha and the fields, or when the file is missing there; the freeze gate runs checkDoneOn over every item whose done_on is set at the base"
    },
    {
      "ref": "docs/gates.md",
      "what": "The verdict checks say the item's contract at verified_sha must match the head's; The contract freeze says a set done_on moves only by a plan-only replan with a ## Done on change section"
    },
    {
      "ref": "docs/language.md",
      "what": "A Plan context line for done_on change"
    },
    {
      "ref": "scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "The builder's tests: contractMoves names expect, outcome and Verifier brief and ignores status and done_on; checkDoneOn cases; the verdict gate in a temp repo refusing a contract reworded in a merged side branch after the verified sha and passing a status-only merge"
    }
  ],
  "expect": [
    {
      "id": "cutoff-refused",
      "check": "In a temp git repo from the head, with a build branch whose item is doing and whose verdict (from a separate session, naming a passing test) was written at verified_sha, node scripts/gates/pr-gate.mjs verdict exits 1 and names the item and the field after a side branch that rewords one Expect check of the item is merged into the build branch, exits 1 and names Verifier brief after a merged side branch that rewords the brief, and exits 1 when the item file is absent at verified_sha; it exits 0 after a merged side branch that changes only the item's status or done_on, or only another file under plan/",
      "how": "The verifier's own tests building the temp repo and running the verdict gate with BASE_SHA set to the side branch's tip, as main would be",
      "proof": "verifier"
    },
    {
      "id": "done-on-held",
      "check": "In a temp git repo from the head with an item whose done_on is set at the base, node scripts/gates/pr-gate.mjs freeze exits 1 and names the item and both dates for a PR that changes the date with no replan label, for a replan-labelled PR that also changes a file outside plan/, and for a plan-only replan-labelled PR whose item has no ## Done on change section, and exits 1 for a plan-only replan that removes done_on without the section; it exits 0 for a plan-only replan-labelled PR whose item gains a ## Done on change section, and for any PR that sets done_on on an item that had none",
      "how": "The verifier's own tests building the temp repo and running the freeze gate with BASE_SHA and PR_LABELS set",
      "proof": "verifier"
    },
    {
      "id": "rules-written",
      "check": "docs/gates.md states, among the verdict checks, that the item's contract at verified_sha must match the head's, and in The contract freeze that a set done_on moves only by a plan-only replan whose item says why under ## Done on change; docs/language.md defines done_on change in the Plan context",
      "how": "The verifier reads the two files",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "scripts/gates/test/lib.test.mjs goes red when contractMoves stops reporting a changed Verifier brief, and again when checkDoneOn stops refusing a moved date; scripts/gates/test/pr-gate.test.mjs goes red when the verdict gate stops reading the item at verified_sha; green again when restored",
      "how": "The verifier breaks each rule in turn and runs the named test file",
      "proof": "builder"
    },
    {
      "id": "plan-passes",
      "check": "node plan/check.mjs passes at the head; the PR changes only the files the outputs name, its own plan item and verify/verdict-cutoff-at-verified-sha/, and no verify/ folder of another item",
      "how": "The verifier runs the plan check and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "world-refuses",
      "check": "A throwaway PR in ccp_xstate based on the head (title starting throwaway:, closed unmerged) naming this item, holding a verdict.json for it whose verified_sha is an earlier commit of the branch and a later commit that rewords one of the item's Expect checks, fails the verdict check on GitHub at its verdict step, and the step's log names the item and expect as the field that moved",
      "how": "The PR and its verdict run on GitHub",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "done_on change (a replan's ## Done on change section saying why an item's set done_on moved)"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "plan/check.mjs and plan/item.schema.json are not changed; the done_on rule lives in the freeze gate",
    "No change to how the freeze treats status, the contract change, or the verdict file cutoff at base and head",
    "No plugin or engine change, so no release",
    "No done item's head, Verifier brief or verify/ folder changes",
    "The evidence gate's edges are evidence-gate-edges, not this item"
  ],
  "records": [
    "The verdict and freeze gates' refusal text, in the verdict run's log, naming the item, the short verified sha and the fields or dates that moved"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A build branch that merged main after its verdict, where main's replan changed only another item, must still pass: the comparison reads this item's file alone"
  ]
}
```

## What this is

The verifier of `verification-contract` found that the contract freeze sees only a PR's base and head. While a
verdict lives on a build branch, a replan from `main` cannot see it, so it may reword the item's Expect checks or
brief; merging `main` back into the build branch keeps the old verdict valid against the new head
(`plan/decisions/2026-11-08-verification-contract-build.md`, "Gap found by the verifier"). This item makes the
verdict hold only for the contract it verified: the verdict gate reads the item at `verified_sha` and refuses when
its contract differs from the head's, naming what moved.

Decision 3 there took `done_on` out of the frozen contract so done replans pass; the side effect is that any PR may
move a set `done_on`, which feeds the fix budget's 14-day window. The freeze gate now holds a set date: it moves only
by a plan-only replan whose item says why under `## Done on change`.

The stand-in choices are in `plan/decisions/2026-11-08-verdict-cutoff.md`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: every verifier
and builder result in your `verdict.json` names its test under `verify/verdict-cutoff-at-verified-sha/`, and the gate
runs them. Without reading the builder's tests, write your own:

- **cutoff-refused:** make a temp git repo from the head (copy `scripts/gates/`), commit a base with an item `x`
  (status ready, a `verifier` Expect line, a `## Verifier brief`), branch `build/x`: set status doing, commit a
  change outside `plan/` and a passing test under `verify/x/` from a builder session, then commit
  `verify/x/verdict.json` (verified_sha the builder's last commit) from another session. For each case, branch a side
  branch from the base, commit the change there, merge it into `build/x`, and run
  `BASE_SHA=<side tip> HEAD_SHA=<merge> PR_BODY="Item: x" PR_LABELS=[] node scripts/gates/pr-gate.mjs verdict`. Cases:
  reword an Expect check (exit 1, names x and expect); reword the brief (exit 1, names Verifier brief); change only
  status or done_on, or only another plan file (exit 0). Also a verdict whose verified_sha predates the item file
  (exit 1).
- **done-on-held:** in a temp repo, commit a base with item `y` (status done, `done_on` set), then run
  `node scripts/gates/pr-gate.mjs freeze` on PR branches: date changed with labels `[]`; with `["replan"]` plus a file
  outside `plan/`; plan-only `["replan"]` with no `## Done on change`; plan-only `["replan"]` removing `done_on`; plan-only
  `["replan"]` adding a `## Done on change` section; and a PR setting `done_on` on an item that had none. Check exit
  codes and that refusals name the item and both dates.
- **rules-written:** read `docs/gates.md` and `docs/language.md`.
- **tests-bite:** make `contractMoves` skip the brief, run `node --test scripts/gates/test/lib.test.mjs`, show red,
  restore; make `checkDoneOn` return no reasons, same; make the verdict gate skip the read at `verified_sha`, run
  `node --test scripts/gates/test/pr-gate.test.mjs`, show red, restore.
- **plan-passes:** `node plan/check.mjs` at the head; read the diff's file list.
- **world-refuses:** from the head, push a throwaway branch that adds `verify/verdict-cutoff-at-verified-sha/verdict.json`
  with verified_sha the head, then a commit rewording one Expect check of this item; open a PR titled "throwaway: ..."
  with `Item: verdict-cutoff-at-verified-sha` in its body, read the verdict step's log, close it unmerged and delete
  the branch.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line under `verify/verdict-cutoff-at-verified-sha/evidence/`: the command,
the excerpt, and the inputs to run it again. No listings, no journal roots.
