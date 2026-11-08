```json
{
  "id": "evidence-gate-edges",
  "title": "Close the evidence gate's symlink and renamed-listing gaps",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The evidence gate refuses an entry under verify/ that is not a regular file (a symlink, whose blob size is the link text and not what it points at, or a submodule), and refuses a file under verify/ whose text is a test listing (node:test pass and fail summary lines with at least ten ok, not ok, ✔ or ✖ result lines, TAP or spec reporter) whatever its name, naming the path and the rule; an evidence file quoting a few result lines and the summary still passes; plan/README.md and docs/gates.md say what the gate refuses and what stays the verifier's job.",
  "why": "The plan verifier of verify-evidence-policy found the gate measures a symlink by git cat-file -s of the link, so a link to a large file passes, and that the .pass rule is a name suffix only, so a listing saved as listing.txt under 64 KB passes (verify/verify-evidence-policy/verdict.json, observations 1 and 2).",
  "serves": [
    "L-contract-names-behaviour",
    "L-count-concepts"
  ],
  "depends_on": [
    "verify-evidence-policy",
    "rules-said-once"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-evidence-gate-edges.md",
      "what": "The stand-in choices this item is built to: non-regular entries refused, a listing told by its summary and ten result lines, docs at the same line count"
    },
    {
      "ref": "verify/verify-evidence-policy/verdict.json",
      "what": "Observations 1 and 2, the two gaps"
    },
    {
      "ref": "scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/",
      "what": "checkEvidence, the evidence gate's reading of kept paths, and the gate tests"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/gates/lib.mjs",
      "what": "checkEvidence takes { path, size, mode, text } and also refuses a mode that is not 100644 or 100755, naming symlink or submodule, and a text that isListing finds; isListing(text) and LISTING_LINES (10)"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs",
      "what": "The evidence gate reads each kept path's mode from git ls-tree at the head, and its text when it is a regular file no larger than the limit, and passes both to checkEvidence"
    },
    {
      "ref": "docs/gates.md",
      "what": "The evidence row and the Evidence section say the gate refuses a non-regular entry and a test listing by its text, and that a short listing and anything else the gate cannot tell by shape stay the verifier's job; same line count"
    },
    {
      "ref": "plan/README.md",
      "what": "The evidence sentence under How slop is kept out says the gate refuses what it can tell by shape and the brief keeps the rest; same line count"
    },
    {
      "ref": "docs/language.md",
      "what": "A line for test listing"
    },
    {
      "ref": "scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs",
      "what": "The builder's tests: checkEvidence refusing a symlink, a submodule and a listing in TAP and spec form, passing a short excerpt; the evidence gate in a temp repo refusing a committed symlink and a listing.txt"
    }
  ],
  "expect": [
    {
      "id": "link-refused",
      "check": "In a temp git repo from the head, a PR branch that adds a symlink under verify/<item>/evidence/ (pointing at a file over 64 KB, and again at a small file) makes node scripts/gates/pr-gate.mjs evidence exit 1 naming the path and that it is a symlink; one that adds a submodule entry under verify/ exits 1 naming the path and that it is a submodule; one that adds only a regular evidence file under the limit exits 0",
      "how": "The verifier's own tests building the temp repo and running the evidence gate with BASE_SHA set to the base",
      "proof": "verifier"
    },
    {
      "id": "listing-refused",
      "check": "In a temp git repo from the head, a PR branch that adds the node:test output of a file with at least ten tests, saved as verify/<item>/evidence/listing.txt, makes node scripts/gates/pr-gate.mjs evidence exit 1 naming the path and that it is a test listing, for TAP output and for spec reporter output; an evidence .md holding a command, four result lines and the pass and fail summary exits 0; a file over 64 KB and a *.pass file are still refused; a deleted listing is never read",
      "how": "The verifier's own tests generating real node:test output and running the evidence gate in the temp repo",
      "proof": "verifier"
    },
    {
      "id": "rules-written",
      "check": "docs/gates.md says the evidence gate refuses an entry under verify/ that is not a regular file and a test listing by its text, and that a listing below the gate's count and what the gate cannot tell by shape stay the verifier's job; plan/README.md's evidence sentence says the same in short; docs/language.md defines test listing; CLAUDE.md, plan/README.md and docs/gates.md total under 230 lines",
      "how": "The verifier reads the files and counts their lines",
      "proof": "verifier"
    },
    {
      "id": "tests-bite",
      "check": "scripts/gates/test/lib.test.mjs goes red when checkEvidence stops refusing a symlink mode, and again when isListing always answers false; scripts/gates/test/pr-gate.test.mjs goes red when the evidence gate stops passing the mode from git ls-tree; green again when restored",
      "how": "The verifier breaks each rule in turn and runs the named test file",
      "proof": "builder"
    },
    {
      "id": "plan-passes",
      "check": "node plan/check.mjs passes at the head; the PR changes only the files the outputs name, its own plan item and verify/evidence-gate-edges/, and no verify/ folder of another item",
      "how": "The verifier runs the plan check and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "world-refuses",
      "check": "A throwaway PR in ccp_xstate based on the head (title starting throwaway:, closed unmerged) adding a symlink under verify/ and a node:test listing of ten or more tests saved as listing.txt under verify/ fails the verdict check on GitHub at its evidence step, and the step's log names both paths and their rules",
      "how": "The PR runs on GitHub",
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
      "test listing (node:test output told by its text: pass and fail summary lines with at least ten result lines)"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "The 64 KB limit and the .pass name rule are not changed",
    "A listing of fewer than ten tests, a journal root or a capture under the limit is not told by the gate; the verifier's brief keeps them out",
    "No done item's verify/ folder changes, and files already on main are not re-read",
    "No plugin or engine change, so no release",
    "plan/check.mjs and plan/item.schema.json are not changed"
  ],
  "records": [
    "The evidence gate's refusal text, in the verdict run's log, naming each path and its rule"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 500000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The listing rule reads test files under verify/ too: a verifier test that needs a listing fixture must build it in code, or its own PR fails the evidence gate"
  ]
}
```

## What this is

The plan verifier of `verify-evidence-policy` (PR #197) found two ways an archive gets back under `verify/` past the
evidence gate. The gate measures each kept path with `git cat-file -s`, which for a symlink is the size of the link's
target name, so a link to a large file passes. And the listing rule is a name suffix, so a listing saved as
`listing.txt` under 64 KB passes. Neither is reachable by a verifier following its brief; both let an archive in by
another route.

The gate now reads each kept path's mode from `git ls-tree` at the head and refuses anything that is not a regular
file, and reads a regular file's text and refuses a test listing whatever its name. A listing is told by a node:test
pass and fail summary with at least ten result lines, so an evidence file that quotes a few lines of TAP as its
excerpt still passes. The choices and what was not adopted are in `plan/decisions/2026-11-08-evidence-gate-edges.md`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: every verifier
and builder result in your `verdict.json` names its test under `verify/evidence-gate-edges/`, and the gate runs them.
Your tests must pass in `ci.yml`'s depth-1 checkout, with no `origin/main` and no `BASE_SHA`: build temp repos. The
listing rule reads your own files under `verify/`, so build any listing fixture in code, never as literal lines. Without
reading the builder's tests, write your own:

- **link-refused:** make a temp git repo (copy `scripts/gates/`), commit a base, then on a PR branch add
  `verify/x/evidence/a.md` as a symlink to a 100 KB file outside `verify/`, and in another case to a small file; run
  `BASE_SHA=<base> node scripts/gates/pr-gate.mjs evidence` and check exit 1 and the path and "symlink" in the output.
  Add a submodule entry (`git update-index --add --cacheinfo 160000,<a commit sha>,verify/x/sub`) and check exit 1
  naming it. A branch adding a regular small evidence file exits 0.
- **listing-refused:** write a test file with ten or more tests, run it with `node --test` piped (TAP) and with
  `--test-reporter=spec`, and commit each output as `verify/x/evidence/listing.txt` on a PR branch: exit 1, naming the
  path and "test listing". An evidence `.md` with a command, four result lines and the summary: exit 0. Check a file
  over 64 KB and a `*.pass` file are still refused, and a branch deleting a listing committed at the base exits 0.
- **rules-written:** read `docs/gates.md`, `plan/README.md` and `docs/language.md`; `wc -l` the three entry texts.
- **tests-bite:** make `checkEvidence` skip the mode check, run `node --test scripts/gates/test/lib.test.mjs`, show red,
  restore; make `isListing` return false, same; make the evidence gate pass no mode, run
  `node --test scripts/gates/test/pr-gate.test.mjs`, show red, restore.
- **plan-passes:** `node plan/check.mjs` at the head; read the diff's file list.
- **world-refuses:** from the head, push a throwaway branch adding a symlink and a ten-test listing as `listing.txt`
  under `verify/`, open a PR titled "throwaway: ...", read the evidence step's log, close it unmerged and delete the
  branch.
- **ci:** read the ci and verdict checks at the head sha.

Commit one small evidence file per Expect line under `verify/evidence-gate-edges/evidence/`: the command, the excerpt,
and the inputs to run it again. No listings, no journal roots.
