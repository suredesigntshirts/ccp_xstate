```json
{
  "id": "own-traps-in-code",
  "title": "Remove the traps the harness owns, so no thread has to remember them",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "npm test in a checkout without node_modules stops at once with one line saying to run npm ci; nested node --test runs in guards go through one helper in test/regression/lib.mjs that removes NODE_TEST_CONTEXT, and the regression-rules guard refuses a guard that strips it itself; scripts/fresh-reader.mjs starts claude -p as a repository-only reader (empty HOME, memory off, its own session and CCP_HARNESS_DIR); scripts/gates/new-verdict.mjs writes a verdict skeleton whose verified_sha is the full sha from git and whose session is the thread's own; and release.mjs, when release.yml already released the merge, says so as a normal outcome.",
  "why": "The memory audit of 9 Nov found these traps rewritten in up to 14 memory files each: the missing npm ci, the child node --test that runs nothing, the fresh reader that loads the container's memory or writes into the thread's journal, the mistyped verified_sha and copied trailer, and 'already released' read as an error. Each cause is the harness's own, so code can remove it rather than a note describe it (L-cheap-home-wins; APOSD, define errors out of existence).",
  "serves": [
    "L-cheap-home-wins",
    "L-harness-overhead"
  ],
  "depends_on": [
    "memory-boundary"
  ],
  "inputs": [
    {
      "ref": "/mnt/project-files/memory-audit/report.md",
      "what": "Sections A and B: each trap, its source files and how often it repeats"
    },
    {
      "ref": "test/regression/lib.mjs, test/regression-rules.test.mjs",
      "what": "The shared helper and the guard over it"
    }
  ],
  "outputs": [
    {
      "ref": "package.json, scripts/ci/",
      "what": "The install check before npm test"
    },
    {
      "ref": "test/regression/lib.mjs, test/regression/",
      "what": "One nested-run helper; guards use it"
    },
    {
      "ref": "scripts/fresh-reader.mjs, scripts/gates/new-verdict.mjs",
      "what": "The two tools"
    },
    {
      "ref": "scripts/release/release.mjs",
      "what": "The already-released outcome"
    },
    {
      "ref": "docs/verifying.md",
      "what": "One line per tool, pointing at it"
    }
  ],
  "expect": [],
  "concepts": {
    "adds": [
      "fresh reader script",
      "verdict skeleton"
    ],
    "merges": [
      "about 20 inline NODE_TEST_CONTEXT strips, into one helper"
    ],
    "removes": [],
    "budget": 2
  },
  "non_goals": [
    "No change to what a verdict must hold or what the gate checks",
    "No trap written down that code removes"
  ],
  "records": [
    "The PR body names each trap and the memory files it came from"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 900000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The install check must not slow npm test or ci, which installs first"
  ]
}
```

## What this is

Draft: the Expect lines are written when it is readied, one per trap, each a break that shows the old symptom is gone
(remove `node_modules`, run a nested suite without the helper, run the fresh reader with memory on disk, and so on).

The traps and where the audit found them:

- **No `node_modules`** (8+ files): about 100 module-not-found failures, or a 20-minute overrun.
- **Child `node --test` runs nothing** (8+ files): about 20 guards each delete `NODE_TEST_CONTEXT` themselves.
- **Fresh reader** (5 files): a `claude -p` reader loads the container's team memory and CLAUDE.md folders, and
  without its own `CCP_HARNESS_DIR` writes into the thread's journal, where the older-writer guard drops the
  thread's rows.
- **Verdict fields** (5 files): a typed `verified_sha` failed the gate once; a trailer copied from an earlier verdict
  names the wrong session; an unquoted heredoc eats backticks.
- **"Already released"** (6 files): `release.yml` tags on merge, so `release.mjs` finding the release made is normal.

Checked and left out: clean-room tests on an uncommitted tree (`plugins/harness/test/helpers.mjs` already commits the
tree with `git stash create`).
