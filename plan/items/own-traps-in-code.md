```json
{
  "id": "own-traps-in-code",
  "title": "Remove the traps the harness owns, so no thread has to remember them",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
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
  "expect": [
    {
      "id": "no-install",
      "check": "In a clone with no node_modules, npm test stops within seconds with one line telling the thread to run npm ci, and starts no test file; once npm ci has run, npm test goes past that check",
      "how": "The verifier runs npm test in a fresh clone before and after npm ci, timing the first run and counting the test files it reports",
      "proof": "verifier"
    },
    {
      "id": "one-nested-helper",
      "check": "Every test file under test/, scripts/, packages/ and plugins/ that starts a child with the test runner's environment gets it from one helper in test/regression/lib.mjs, which drops NODE_TEST_CONTEXT, so the child runs and reports its own tests; the regression-rules guard goes red, naming the file, when a test file drops NODE_TEST_CONTEXT itself",
      "how": "The verifier runs a child node --test inside node --test with the helper's environment and with the parent's, and adds an inline drop to a copy of one guard to see the rules guard refuse it",
      "proof": "verifier"
    },
    {
      "id": "fresh-reader-env",
      "check": "scripts/fresh-reader.mjs starts claude -p with the prompt on stdin, an empty HOME and an empty CCP_HARNESS_DIR of its own, auto memory off, and none of the thread's session id, memory store or additional CLAUDE.md folder variables",
      "how": "The verifier puts a stub claude first on PATH that records its arguments, stdin and environment, and runs the script from an environment that sets all of them",
      "proof": "verifier"
    },
    {
      "id": "fresh-reader-real",
      "check": "From a thread, a real fresh reader answers from the repository alone: a fact planted only in the caller's HOME CLAUDE.md is unknown to it, while plain claude -p repeats it, and the run adds no file under the caller's CCP_HARNESS_DIR",
      "how": "The verifier plants a codeword in the container's HOME CLAUDE.md, asks both readers for it, lists the caller's harness folder before and after, and removes the codeword",
      "proof": "world"
    },
    {
      "id": "verdict-skeleton",
      "check": "scripts/gates/new-verdict.mjs <item> writes verify/<item>/verdict.json with the full commit id git gives for HEAD as verified_sha, the thread's own session URL taken from CLAUDE_CODE_REMOTE_SESSION_ID, one empty result per Expect line with test slots where the proof needs them, prints the Claude-Session trailer to commit it with, refuses without a session id, and refuses to overwrite a verdict that exists; the verdict gate refuses the skeleton until its results are filled",
      "how": "The verifier runs the script in temp repos holding a ready item, then runs pr-gate.mjs verdict over the unfilled skeleton",
      "proof": "verifier"
    },
    {
      "id": "already-released",
      "check": "release.mjs branch at a merge that already carries a harness-v release tag exits 0 and says the merge is already released under that tag and nothing is left to do, rather than reporting no release; a merge with no release and nothing released changed still reports no release",
      "how": "The verifier runs release.mjs branch in temp repos with a tag at the merge and with no released change",
      "proof": "verifier"
    },
    {
      "id": "docs-point",
      "check": "docs/verifying.md names scripts/fresh-reader.mjs and scripts/gates/new-verdict.mjs, one line each, and neither docs/verifying.md nor docs/traps.md spells out the env -u recipe the fresh reader now holds",
      "how": "The verifier reads the two notes files for the two paths and for the variable names",
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

Each Expect line is one trap with the break that shows its old symptom is gone: `npm test` without `node_modules`,
a nested run without the helper, a reader with memory on disk, a verdict whose fields were typed, and a release that
`release.yml` already made.

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

How each is removed, and what was weighed:

- **Install check.** A `pretest` script, run by npm before `test`, resolves `xstate` from the root and exits with one
  line when it is missing. `ci` and `setup.sh` install first, so the check costs one node start. A check inside each
  test file was weighed and left: a hundred places to keep, for the same line.
- **Nested runs.** The helper is a function returning the parent's environment without `NODE_TEST_CONTEXT` and
  without any other keys the caller names (the gate tests also drop `BASE_SHA`, `HEAD_SHA` and the `PR_` keys). The
  rule covers test files only: `scripts/gates/pr-gate.mjs`, the inspector, the bench and the tournament kit are tools,
  which cannot import from `test/`, and keep their own drop.
- **Fresh reader.** A script, not a doc line, so the variable list lives in one place; the verifier briefs that spell
  it out point at the script once this lands.
- **Verdict skeleton.** It fills only what the thread could get wrong by hand (sha, session, ids, slots), never a
  status or an excerpt, so it cannot pass the gate on its own.
- **Already released.** The decision stays a skip in the journal row (`docs/journal.md` allows `released` or
  `skipped`); only what the script says changes, since the thread reads that line and reports it.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`, except for no-install, which needs a clone without
it. For fresh-reader-real, put the codeword in `$HOME/.claude/CLAUDE.md` for the two runs only and remove it after,
and start the plain control as `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p ... < /dev/null`. Write the verdict
by hand or with the new script; either way `verified_sha` comes from `git rev-parse`.
