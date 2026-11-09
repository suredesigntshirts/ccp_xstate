```json
{
  "id": "regression-folder-rules",
  "title": "Guard the regression folder's own rules and the two test-speed rules with one static check",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "One guard under test/, reading files only, fails when a test file under test/regression/ has no first-line Expect: header naming item/expect ids that exist in plan/items, when a file under test/regression/ reads under verify/, when a .mjs or .js file there other than lib.mjs is not a test file, when a guard under test/, scripts/, packages/ or plugins/ makes a working clone of the repo other than through leanClone, or when a guard that runs setup.sh does not set CCP_SETUP_SKILLS unless it tests the skill install; lean-clone.test.mjs and setup-skills-switch.test.mjs carry headers; and docs/language.md names guard and proof.",
  "why": "regression-set-leftovers took verify/ out of npm test on 9 Nov. Its verifier noted that the regression set's own rules (headers, no verify/ reads, one helper) were held by verify/verify-regression-set suites that no longer run, and that the header rule already failed for the two guards that item added; the fast-clones item's clones-through-helper and tests-set-switch rules lost their only checks the same way (verify/regression-set-leftovers/verdict.json observations).",
  "serves": [
    "L-rules-live-in-the-repo",
    "L-harness-overhead"
  ],
  "depends_on": [
    "regression-set-leftovers"
  ],
  "inputs": [
    {
      "ref": "verify/verify-regression-set/one-helper.test.mjs, verify/verify-regression-set/moved-pass.test.mjs, verify/fast-test-clones-and-setup/clones-through-helper.test.mjs, verify/fast-test-clones-and-setup/tests-set-switch.test.mjs",
      "what": "The rules those proofs checked, to restate as one static guard"
    },
    {
      "ref": "test/regression/",
      "what": "The headers, helpers and fixtures the guard reads"
    }
  ],
  "outputs": [
    {
      "ref": "test/regression-rules.test.mjs",
      "what": "The static guard, one test per rule, reading files only"
    },
    {
      "ref": "test/regression/plugin/lean-clone.test.mjs, test/regression/plugin/setup-skills-switch.test.mjs",
      "what": "First-line Expect: headers"
    },
    {
      "ref": "docs/language.md",
      "what": "Lines for guard and proof"
    }
  ],
  "expect": [
    {
      "id": "rules-bite",
      "check": "The guard fails, naming the file, for each of: a regression test file with no header, a header naming an Expect id no item holds, a regression file that reads under verify/, a second helper file under test/regression/, a guard cloning the repo with plain git clone, and a guard running setup.sh without CCP_SETUP_SKILLS; and passes at the head",
      "how": "The verifier adds each break in a copy and runs the guard there",
      "proof": "verifier"
    },
    {
      "id": "static",
      "check": "The guard runs no child process and makes no clone, and takes under two seconds",
      "how": "The verifier reads the file and times it",
      "proof": "verifier"
    },
    {
      "id": "words",
      "check": "docs/language.md has a line for guard and for proof, each naming where it lives",
      "how": "The verifier reads the file",
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
    "adds": [],
    "merges": [
      "four retired proofs' rules, into one guard"
    ],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No rerun of other test files: the guard reads source text only",
    "No plugin or engine change, so no release"
  ],
  "records": [
    "The PR body names each rule and the proof it came from"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A static read of clone calls can miss a clone built by a helper of the file's own; the guard follows a file's local functions only as far as its own text"
  ]
}
```

## What this is

Proofs prove a PR once; rules that should keep holding need a guard. Four retired proofs held rules nobody checks
now. They are all about source text, so one file-reading guard holds them for a fraction of a second per PR.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. Write your tests under `verify/regression-folder-rules/`.
For rules-bite, make each break in a lean copy of the head and run the guard there.
