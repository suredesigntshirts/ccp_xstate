```json
{
  "id": "retire-doing",
  "title": "Retire the doing status, which no step of the path sets",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "doing is not a status: item.schema.json leaves it out, so plan/check.mjs refuses an item that holds it; the plan check's pins, module and fix-budget rules hold ready items; the freeze gate freezes an item named by the PR, done at the base, or holding a verdict file; and plan/README.md, docs/gates.md and the plan check describe the path with draft, ready and done alone, with merged listed among the statuses off the path.",
  "why": "Since done-with-the-build a build PR's first commit sets its item done, so no step sets doing and main never holds it, yet the schema, the plan check, the freeze gate and the README still name it. A reader meets a status the path never uses and has to ask when it applies (L-rules-live-in-the-repo; decisions plan/decisions/2026-11-08-refine-round-5.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "done-with-the-build"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-refine-round-5.md",
      "what": "Read first: why doing leaves, and what happens to suites that made up doing items"
    },
    {
      "ref": "plan/item.schema.json, plan/check.mjs, scripts/gates/pr-gate.mjs, scripts/gates/lib.mjs",
      "what": "The status list, the rules that name ready or doing, and the freeze gate's frozen set"
    },
    {
      "ref": "plan/README.md, docs/gates.md",
      "what": "The path's statuses, the contract-change rule, the fix budget and the freeze section"
    }
  ],
  "outputs": [
    {
      "ref": "plan/item.schema.json",
      "what": "The status enum without doing"
    },
    {
      "ref": "plan/check.mjs",
      "what": "The pins, module-exists and fix-budget rules hold ready items; its comments name no doing; the comment describing the removed reader_effort rule leaves"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs, scripts/gates/lib.mjs",
      "what": "The freeze gate freezes an item done at the base (and, as before, one the PR names or one with a verdict file)"
    },
    {
      "ref": "plan/README.md",
      "what": "Off the path lists split, merged, dropped, parked; the pins rule and fix budget say ready; the contract change happens after the build PR names the item and before its verdict file exists"
    },
    {
      "ref": "docs/gates.md",
      "what": "The freeze section: frozen when the PR names it, its base status is done, or it has a verdict file"
    },
    {
      "ref": "test/plan-check.test.mjs",
      "what": "Cases made at doing move to ready (ready items get clean Expect lines); a test that an item at doing is refused"
    },
    {
      "ref": "scripts/gates/test/pr-gate.test.mjs",
      "what": "Freeze tests whose build commit set doing set done"
    },
    {
      "ref": "verify/verification-contract/behaviour-lines.test.mjs, verify/verification-contract/contract-change-once.test.mjs, verify/verification-contract/plan-and-suite-pass.test.mjs, verify/verification-contract/lib.mjs",
      "what": "The doing cases of behaviour-lines leave beside their ready twins; contract-change-once's base item is done (frozen) rather than doing; the module helpers and the live-item filter read ready"
    },
    {
      "ref": "verify/fix-budget-rule/budget-refuses.test.mjs, verify/fix-budget-rule/names-module.test.mjs, verify/fix-budget-rule/lib.mjs",
      "what": "The fourth-at-doing test and the doing case of names-module leave beside their ready twins; the module helper reads ready"
    },
    {
      "ref": "verify/verdict-cutoff-at-verified-sha/cutoff-refused.test.mjs, verify/verdict-cutoff-at-verified-sha/done-on-held.test.mjs",
      "what": "The build branch sets done rather than doing; the undated item is ready"
    },
    {
      "ref": "verify/plan-reader-effort/not-a-contract-change.test.mjs, verify/plan-reader-effort/plan-rule.test.mjs",
      "what": "The verified base item is ready rather than doing; the module helper reads ready"
    },
    {
      "ref": "verify/rules-said-once/item-line-names.test.mjs, verify/item-head-trim/lib.mjs",
      "what": "The toy item is done rather than doing; the plan copy makes modules of ready items"
    }
  ],
  "expect": [
    {
      "id": "doing-refused",
      "check": "On a temp copy of the head's plan/, an item whose status is doing makes node plan/check.mjs exit non-zero naming that item's status field, and the same item at ready or done does not",
      "how": "The verifier's own test on a temp plan copy",
      "proof": "verifier"
    },
    {
      "id": "ready-rules",
      "check": "On a temp copy of the head's plan/, the plan check refuses a ready item whose Expect check pins main, a ready item naming a module that does not exist, and a ready fourth fix to a module with three done fixes in 14 days; and in a temp repo the freeze gate refuses a PR without the replan label that changes the Expect lines of an item done at the base, and passes one that changes an item at ready that the PR does not name and that has no verdict file",
      "how": "The verifier's own tests driving plan/check.mjs and scripts/gates/pr-gate.mjs",
      "proof": "verifier"
    },
    {
      "id": "texts-name-the-path",
      "check": "plan/README.md, docs/gates.md, docs/language.md, CLAUDE.md, plan/check.mjs and scripts/gates/ name no doing status; plan/README.md names every status item.schema.json allows",
      "how": "The verifier's own test reading those files and the schema enum",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "The plan-check test that an item at doing is refused goes red when doing is put back into item.schema.json's status enum, and green when restored",
      "how": "The verifier breaks the schema and runs test/plan-check.test.mjs",
      "proof": "builder"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head, and the PR changes only the files the outputs name and its own plan item",
      "how": "The verifier runs both and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [
      "doing as a status"
    ],
    "budget": 0
  },
  "non_goals": [
    "Done items, decision files and evidence that mention doing keep their wording; they are history",
    "No released file changes, so no release",
    "The contract-change rule's meaning does not move; only its wording stops naming a status"
  ],
  "records": [
    "The new plan-check test's output on the PR's ci run"
  ]
}
```

## What this is

Round 5 of the refine rounds. Round 4 moved `done` into the build PR's first commit, so `doing` became a status no
step sets: main never held it before, and no branch holds it now. The schema, the plan check, the freeze gate and the
README still named it, so a reader had one more word to place. This item takes it out and says each rule in terms of
`ready`, `done` and the build PR. The decisions are in `plan/decisions/2026-11-08-refine-round-5.md`.

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Write your tests under `verify/retire-doing/` without reading
the builder's. `verify/verification-contract/lib.mjs` has a temp-plan helper and `verify/rules-said-once/lib.mjs` a
temp-repo helper for the freeze gate; copy what you need. A plan copy holds `plan/` alone, so make an empty file at each
module a ready item names before running the check. Fix-item rules need a `fix-` id and a `module`.
