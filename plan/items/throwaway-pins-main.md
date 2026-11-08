```json
{
  "id": "throwaway-pins-main",
  "title": "Throwaway: an item whose Expect line pins main",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "An Expect check in a ready or doing item may not pin main (plan/check.mjs refuses the phrases decision 1 lists and any sha); a verdict result for a verifier or builder line names the test that proves it and the verdict gate runs that test at the PR head, while what the verifier judged sits in an observations list that never gates; a doing item's head and Verifier brief may change once by a replan with a Contract change section before its verdict file exists and never after; and plan/README.md, docs/gates.md, CLAUDE.md and docs/language.md say so in the words of plan/decisions/2026-11-08-verification-swing.md.",
  "why": "The seven design-books cleanups were held to Expect lines that pinned main's bytes, so each could add but not remove, and the gate reads MET as a word beside an excerpt rather than as a test result (L-contract-names-behaviour, L-verdict-is-a-test-result; research plan/research/verification-swing.md).",
  "serves": [
    "L-contract-names-behaviour",
    "L-verdict-is-a-test-result",
    "L-proof-source",
    "L-expect-format-one-owner"
  ],
  "depends_on": [
    "fix-budget-rule"
  ],
  "inputs": [
    {
      "ref": "plan/research/verification-swing.md",
      "what": "Read this first; the short version; the items table"
    },
    {
      "ref": "plan/decisions/2026-11-08-verification-swing.md",
      "what": "Decisions 1, 2, 3 and 6: the deny-list, the test field and observations, the one contract change, the three glossary words; the old and new texts for CLAUDE.md, plan/README.md and docs/gates.md"
    },
    {
      "ref": "plan/check.mjs, plan/item.schema.json, test/plan-check.test.mjs",
      "what": "The plan check, the head schema and the builder tests of the fix budget, which the new rules sit beside"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/*.test.mjs, .github/workflows/verdict.yml",
      "what": "checkVerdict, checkFreeze and checkSessions, the git-reading wrapper, and the gate tests"
    },
    {
      "ref": "verify/fix-budget-rule/verdict.json",
      "what": "The newest verdict in the current shape, to read against the new fields"
    }
  ],
  "outputs": [
    {
      "ref": "plan/check.mjs",
      "what": "Refuses a ready or doing item whose Expect check matches the deny-list (decision 1), naming the item, the Expect id and the phrase; refuses contract_changes above 1, and 1 without a Contract change section in the item file"
    },
    {
      "ref": "plan/item.schema.json",
      "what": "contract_changes: an integer, 0 or 1, optional"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs",
      "what": "checkVerdict requires test on every result whose Expect proof is verifier or builder, a path under verify/<item>/ with an optional name, and the gate runs it with node --test at the head and refuses a failing or missing one; observations is an optional list of strings; checkFreeze refuses a head or brief change when verify/<item>/verdict.json exists at base or head, label or not"
    },
    {
      "ref": "plan/README.md",
      "what": "How slop is kept out: the contract names behaviour (the deny-list by reference), the verdict names its tests, observations, and the frozen-contract bullet in the new text; the head-field table gains contract_changes"
    },
    {
      "ref": "docs/gates.md",
      "what": "The verdict example and the gate list carry test and observations; the contract freeze section carries the one contract change and the verdict-file rule"
    },
    {
      "ref": "CLAUDE.md",
      "what": "The cleanup principle in decision 4's new text; the file stays under 100 lines"
    },
    {
      "ref": "docs/language.md",
      "what": "Plan context lines for regression set, observation and contract change; Where contexts meet says plan verifier where the verify model stage could be meant"
    },
    {
      "ref": "test/plan-check.test.mjs, scripts/gates/lib.test.mjs",
      "what": "The builder's tests: each deny-list phrase and the sha pattern refused at ready and doing and passed at draft and done; contract_changes 2 refused, 1 without the section refused, 1 with it passed; a verdict result without test refused, with a failing test refused, with a passing one passed, a world line without test passed; a head change with a verdict file present refused under the replan label"
    }
  ],
  "expect": [
    {
      "id": "renders-pinned",
      "check": "Every stage renders to main's bytes",
      "how": "the verifier compares",
      "proof": "verifier"
    },
    {
      "id": "verdict-runs-tests",
      "check": "In a temp git repo holding a copy of the head with a PR-shaped branch, the verdict gate passes a verdict whose results for verifier and builder lines each name a test file under verify/<item>/ that passes, and whose world line names none; it refuses, naming the Expect id and the test, a result whose named test fails; it refuses a verifier or builder result that names no test; a result naming a test that exits non-zero for a reason other than an assertion is refused the same way; the presence or absence of observations changes neither outcome",
      "how": "The verifier's own tests driving BASE_SHA=... node scripts/gates/pr-gate.mjs verdict in the temp repo",
      "proof": "verifier"
    },
    {
      "id": "contract-change-once",
      "check": "In the temp repo: a replan-labelled, plan-only PR that changes a doing item's Expect lines, sets contract_changes to 1 and adds a Contract change section passes the freeze gate and the plan check; the same with contract_changes 2 is refused by the plan check; with 1 and no section is refused by the plan check; a replan-labelled, plan-only PR that changes the head of an item whose verify/<item>/verdict.json exists at the base is refused by the freeze gate, naming the item and the verdict file",
      "how": "The verifier's own tests in the temp repo, running the freeze gate and the plan check",
      "proof": "verifier"
    },
    {
      "id": "rules-written",
      "check": "plan/README.md's How slop is kept out states the deny-list rule by pointing at the decision, the test field, observations, and the one-contract-change rule with the verdict-file cutoff; docs/gates.md's verdict example shows test and observations and its freeze section states the cutoff; CLAUDE.md carries decision 4's cleanup principle and has fewer than 100 lines; docs/language.md defines regression set, observation and contract change",
      "how": "The verifier reads the four files",
      "proof": "verifier"
    },
    {
      "id": "world-refuses",
      "check": "A throwaway PR in ccp_xstate based on the head (title starting throwaway:, closed unmerged) that adds one ready item whose Expect check contains a phrase decision 1 lists fails the ci check on GitHub at its plan check step, and the step's log names the item, the Expect id and the phrase",
      "how": "The PR and its ci run on GitHub",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "test/plan-check.test.mjs goes red when the deny-list in check.mjs is emptied, and scripts/gates/lib.test.mjs goes red when checkVerdict stops requiring test; both green again when restored",
      "how": "The verifier breaks each and runs the named test file",
      "proof": "builder"
    },
    {
      "id": "plan-and-suite-pass",
      "check": "node plan/check.mjs passes on the head's real plan with every done item exempt from the deny-list; npm test passes at the head; the PR changes only the files the outputs name plus the gate's own test files, and no verify/ folder of another item",
      "how": "The verifier runs the plan check and the suite at the head and reads the diff",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "observation (a verifier's judged note on a verdict, never a gate)",
      "contract change (the one replan a doing item may have before its verdict file exists)"
    ],
    "merges": [],
    "removes": [
      "the per-item Expect line that every test passing on main passes at the head"
    ],
    "budget": 2
  },
  "non_goals": [
    "No plugin or engine change, so no release",
    "The verify model stage and workflows/quick-fix/verify.md are untouched",
    "No done item's head, Verifier brief or verify/ folder changes; retiring done suites is verify-regression-set",
    "No allow-list of glossary words: a deny-list of the pinning phrases, extended by one line when a new way is seen",
    "The gate does not run the whole suite; it runs the tests the verdict names, and ci runs the suite",
    "No evidence-size rule yet: that is verify-evidence-policy"
  ],
  "records": [
    "The plan check's refusal text, in CI's log, naming item, Expect id and phrase"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A done item's Expect lines contain the phrases everywhere, so the exemption for done items is what keeps the current plan passing; the builder's first run of check.mjs on the real plan shows it",
    "Running named tests inside the verdict gate lengthens the gates job by those tests' time; the verifier's tests for this item are small"
  ]
}
```

## What this is

The quality review of the seven design-books cleanups (`plan/research/verification-swing.md`) found that the
verifier did what the contract asked and the contract asked for conservation: "every stage renders to main's bytes",
"npm test at both shas". Six done suites therefore archive main and compare, no cleanup could delete anything, and
the gate ties no MET to a test. This item changes the contract and the gate, and leaves the verifier's independence
alone. The decisions are in `plan/decisions/2026-11-08-verification-swing.md`, sections 1, 2, 3 and 6; section 4
gives the `CLAUDE.md` text this item writes.

It is the first item built under its own rule: its Expect lines name what the check and the gate do on copies, not
what the repository's files equal. It is also the first whose verdict must name its tests, so the verifier reads
`docs/gates.md` at the head, not at main, before writing `verdict.json`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: your
`verdict.json` carries `test` on every verifier and builder result, and the gate runs them. Without reading the
builder's tests, write your own under `verify/verification-contract/`:

- **behaviour-lines:** copy the head's `plan/` to a temp folder, edit or add item heads there, run
  `node <temp>/check.mjs`, check exit code and output. Take the phrase list from decision 1, not from check.mjs.
- **verdict-runs-tests** and **contract-change-once:** make a temp git repo from the head (`git clone` of the
  checkout, or `git worktree`), commit a base and a branch as a PR would, and run `BASE_SHA=<base>
  node scripts/gates/pr-gate.mjs verdict` and `freeze` with `PR_LABELS` and `PR_BODY` set as the gate reads them.
  Write small `verify/<item>/*.test.mjs` files in the temp repo that pass, fail by assertion and exit non-zero.
- **rules-written:** read the four files; count `CLAUDE.md`'s lines.
- **world-refuses:** from the head, push a throwaway branch adding a ready item whose check says "renders to main's
  bytes", open a PR titled "throwaway: ...", read its ci run's plan check step, close it unmerged.
- **tests-bite:** empty the deny-list, run `node --test test/plan-check.test.mjs`, show red, restore; remove the
  `test` requirement from `checkVerdict`, run `node --test scripts/gates/lib.test.mjs`, show red, restore.
- **plan-and-suite-pass:** `node plan/check.mjs` and `npm test` at the head; read the diff's file list.
- **ci:** read the ci and gates checks at the head sha.

Commit one small evidence file per Expect line: the command, the excerpt, and the inputs to run it again. No
listings, no journal roots.
