# PR gates

Two workflows run on every PR into `main`, and a PR merges only when both are green at its head sha. They check the
rules of `plan/README.md`, "How slop is kept out", so the builder isn't the one enforcing them.

| Workflow | Step | Fails when |
|---|---|---|
| `ci` | `npm test` | any test under `test/`, `scripts/`, `packages/`, `plugins/` or `verify/` fails |
| `ci` | plan check | `node plan/check.mjs` refuses the plan |
| `verdict` | no stubs | a file under `packages/` or `plugins/` has TODO, FIXME, "not implemented" or a skipped test, or a line of the harness source or its two READMEs has a history reference (`docs/layout.md`, "Comments") |
| `verdict` | contract freeze | the PR changes a frozen item's head or Verifier brief and isn't a plan-only replan, or the item already has a verdict file |
| `verdict` | evidence | the PR adds, changes or renames a file under `verify/` to one larger than 64 KB (65,536 bytes) or named `*.pass` |
| `verdict` | verdict | the named item has no complete verdict at the head sha, a test it names fails or is missing, or the verdict came from a builder's session; or the PR names no item and changes files outside `plan/` |

A PR names its item only by an `Item: <id>` line in its body. The checks are in `scripts/gates/lib.mjs`; run one
locally with `BASE_SHA=origin/main node scripts/gates/pr-gate.mjs verdict`, setting `PR_BODY` and `PR_LABELS`.

## The verdict

The verifier, a session other than the builder's, commits `verify/<item>/verdict.json`:

```json
{
  "item": "repo-skeleton", "verified_sha": "<the commit the verifier checked out>",
  "verifier": { "session": "<its Claude-Session value>", "model": "<model id>" },
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

- every Expect id, and no other, has a `MET` result with a non-empty `command` and `excerpt`;
- every `verifier` or `builder` result names in `test` a file under `verify/<item>/` (and optionally a name pattern in
  `test_name`); a `world` result names none;
- every named test passes: the gate runs `node --test-reporter=tap [--test-name-pattern=<test_name>] <file>` from
  the head checkout and refuses one that exits non-zero or passes no test;
- every `builder` result has a `mutation` and a `red_test`; `observations`, if present, is a list of strings;
- `verified_sha` is in the PR's history, and no later commit other than a merge changes anything outside `verify/`;
- the last commit that wrote `verdict.json` has a `Claude-Session:` trailer that no commit changing anything outside
  `verify/` carries.

## Evidence

For each Expect line the verifier commits one evidence file, `verify/<item>/evidence/<expect-id>.md`: the command it
ran, the excerpt it saw and the inputs needed to run it again (the sha, the temp files it made, the environment it
set). It commits no test listing, no journal root and no capture of main.

The evidence gate refuses a file a PR adds, changes or renames under `verify/` that is larger than 64 KB at the head
or named `*.pass`; a deleted file is never read. The limit is `EVIDENCE_LIMIT` in `scripts/gates/lib.mjs`.

## Sessions

Every commit ends with `Claude-Session: <id>`: a thread's session URL, or `<thread session URL>#agent=<name>` for a
subagent inside it. This is identity by convention: every agent acts as the person's GitHub account, so a builder
could forge a verdict commit; a separate identity stays parked until one is seen (ledger L-same-account-everywhere).

## The contract freeze

An item is frozen when the PR names it, its status at the base is `doing` or `done`, or it has a verdict file. A
frozen item's head (all but `status` and `done_on`) and `## Verifier brief` change only by its one contract change: a
PR labelled `replan` that changes nothing outside `plan/`, with `contract_changes` 1 and a `## Contract change`
section. Verification has started once `verify/<item>/verdict.json` exists at the PR's base or head; from then on the
gate refuses any head or brief change, label or not.

## After the merge

The thread that merged runs `git fetch origin main && node scripts/release/release.mjs branch --push`. When the merge
changed `plugins/harness/` or `packages/journal/` (tests aside), that pushes `release/harness-v<x.y.z>` and prints a
`ci.result` row for the thread's journal; otherwise it makes nothing, so it is safe after every merge. See
`plugins/harness/README.md`, "Releases".
