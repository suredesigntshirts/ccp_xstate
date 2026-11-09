# PR gates

Two workflows run on every PR into `main`, and a PR merges only when both are green at its head sha. They check the
rules of `plan/README.md`, "How slop is kept out", in `scripts/gates/lib.mjs`.
Run one at the checkout's HEAD with `BASE_SHA=origin/main PR_BODY='Item: <id>' node scripts/gates/pr-gate.mjs verdict`.

| Workflow | Step | Fails when |
|---|---|---|
| `ci` | guards | a guard fails: on a PR, the guard files under `test/`, `scripts/`, `packages/` or `plugins/` that the change reaches (`scripts/ci/select-tests.mjs`; all of them when it changes a shared file or one no guard reaches); on `main`, all of them by `npm test`. `verify/` is not run here: the verdict gate runs a PR's own verifier tests |
| `ci` | plan check | `node plan/check.mjs` refuses the plan |
| `verdict` | no stubs | a file under `packages/` or `plugins/` has TODO, FIXME, "not implemented" or a skipped test, or a line of the harness source or its two READMEs has a history reference (`docs/layout.md`, "Comments") |
| `verdict` | contract freeze | the PR changes a frozen item's head or Verifier brief and isn't a plan-only replan, or the item already has a verdict file |
| `verdict` | evidence | the PR adds, changes or renames under `verify/` an entry that is not a regular file (a symlink, a submodule), one larger than 64 KB (65,536 bytes), one named `*.pass`, or a test listing: a node:test pass and fail summary with ten or more result lines; a deletion is never read |
| `verdict` | verdict | the named item has no complete verdict for the head (below), a test it names fails or is missing, or the verdict came from a builder's session; or the PR names no item and changes files outside `plan/` and the notes files, `docs/traps.md` and `docs/verifying.md` |

## The verdict

The verifier, a session other than the builder's, commits `verify/<item>/verdict.json`:

```json
{
  "item": "repo-skeleton", "verified_sha": "<the commit the verifier checked out>",
  "verifier": { "session": "<its Claude-Session value>", "model": "<its own model id>" },
  "results": [
    { "id": "ci-runs", "status": "MET", "command": "what it ran", "excerpt": "what it saw" },
    { "id": "a-verifier-line", "status": "MET", "command": "node --test verify/repo-skeleton/layout.test.mjs",
      "excerpt": "...", "test": "verify/repo-skeleton/layout.test.mjs" },
    { "id": "a-builder-line", "status": "MET", "command": "node --test test/a.test.mjs", "excerpt": "...",
      "test": "verify/repo-skeleton/bites.test.mjs", "test_name": "a.test.mjs goes red",
      "mutation": "the code it broke", "red_test": "the test that went red" }
  ],
  "observations": ["what the verifier judged rather than ran: a naming concern, a design smell, a doc gap"]
}
```

The gate checks, against the item head at the PR head sha:

- every Expect id, and no other, has a `MET` result with a non-empty `command` and `excerpt`; a `world` result needs
  no `test`, and one about the PR's checks cites them at `verified_sha`, since they run again on the verdict commit;
- each `verifier` or `builder` result names a file under `verify/<item>/` in `test`, maybe a pattern in `test_name`,
  and each `builder` result a `mutation` and a `red_test`; `observations`, if present, is a list of strings;
- every named test passes: the gate runs `node --test-reporter=tap [--test-name-pattern=<test_name>] <file>` from
  the head checkout and refuses one that exits non-zero or passes no test;
- `verified_sha` is in the PR's history, no later commit other than a merge changes anything outside `verify/`, and
  the item's contract (see below) at `verified_sha` matches the head's, or the gate names the fields that moved;
- the last commit to `verdict.json` has a `Claude-Session:` trailer that no commit changing files outside `verify/` has.

## Evidence

For each Expect line the verifier commits one evidence file, `verify/<item>/evidence/<expect-id>.md`: the command it
ran, the excerpt it saw and the inputs to run it again (the sha, the temp files it made, the environment it set). It
commits no test listing, no journal root and no capture of main; the gate tells what it can by shape, the brief the rest.

The evidence gate refuses a path a PR adds, changes or renames under `verify/` that is not a regular file (a symlink,
a submodule), is over 64 KB, is named `*.pass` or reads as a test listing (`isListing` in `scripts/gates/lib.mjs`).

## Sessions

Every commit ends with `Claude-Session: <id>`: a thread's session URL, or `<thread session URL>#agent=<name>` for a
subagent inside it. This is identity by convention: every agent acts as the person's GitHub account, so a builder
could forge a verdict commit; a separate identity stays parked until one is seen (ledger L-same-account-everywhere).

## The contract freeze

An item is frozen when the PR names it, its status at the base is `done`, or it has a verdict file. Its head
(all but `status`, `done_on` and `reader_effort`) and `## Verifier brief` change only by its one contract change: a PR
labelled `replan` that changes nothing outside `plan/`, with `contract_changes` 1 and a `## Contract change` section.
Once `verify/<item>/verdict.json` exists at the PR's base or head, the gate refuses any head or brief change, label or
not. A `done_on` set at the base moves only by such a replan whose item says why under `## Done on change`.

## After the merge

The thread that merged runs `git fetch origin main && node scripts/release/release.mjs branch --push`: it pushes
`release/harness-v<x.y.z>` if the merge changed a path in its `RELEASED`, else nothing (`plugins/harness/README.md`).
