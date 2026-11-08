# Building the verification contract: the builder's choices (2026-11-08)

Claude's two-way-door decisions while building `verification-contract` (PR #189), as stand-in for the person, with
what its verifier observed about each. They refine `plan/decisions/2026-11-08-verification-swing.md`, decisions 2
and 3; where they differ from its text, this file holds.

## 1. The verdict workflow installs dependencies

`.github/workflows/verdict.yml` runs `npm ci` before the verdict step, so a test the verdict names can import the
workspaces (xstate, the engine). The item's outputs did not list the workflow; the outcome needs it. The job already
runs the head's own scripts with `contents: read`, so the step adds no trust it did not have. The verifier accepted
it.

## 2. The gate runs a named file as the entry point, not under `node --test`

Decision 2 says `node --test <file>`. Under `--test`, a `--test-name-pattern` that matches no test still reports the
file as one passing test, so "the named test passed" could be vacuous. The gate runs
`node --test-reporter=tap [--test-name-pattern=<test_name>] <file>`, reads the TAP summary of the file's own tests,
and refuses a non-zero exit or zero passing tests. `docs/gates.md` states the real command. The verifier confirmed
the difference.

## 3. `done_on` is outside the frozen contract, like `status`

Without this, the freeze would refuse every done replan of an item that names a module, because its verdict file
exists by then. Side effect, from the verifier: any PR may now change `done_on`, label or not, and `done_on` feeds
the fix budget's 14-day window; `check.mjs` checks only its format. Filed with the gap below: freeze `done_on` once
set (absent to a date only).

## 4. The test is one string field

A result carries `test` (a path under `verify/<item>/`) and optionally `test_name` (a name pattern). One file per
result; a file may prove several lines, and the gate runs each file and name once.

## Gap found by the verifier

The verdict-file cutoff sees only the PR's base and head. While the verdict lives on the build branch, a replan PR
from `main` cannot see it, so it may still reword a doing item's Expect checks after verification started. Merging
`main` back into the build branch does not invalidate the verdict either, so the gate would check the old verdict
against the reworded head; only an added or removed Expect id is caught. Filed as the draft item
`verdict-cutoff-at-verified-sha`: the verdict gate compares the item's contract at `verified_sha` with the head's.

## Also noted

The item's brief and `tests-bite` name `scripts/gates/lib.test.mjs`; the file is `scripts/gates/test/lib.test.mjs`.
The item is done, so its text stays.
