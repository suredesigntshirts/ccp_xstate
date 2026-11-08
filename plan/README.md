# The v2 plan

This folder is the plan for building the harness again on XState, in this repo. The plan is data: every item is one
file with a fixed JSON head, so `check.mjs` can check it and the harness can take work from it. Nothing is built until
an item is `ready` and a thread picks it up.

```
plan/
  README.md          this file: how an item moves, how it is written, how the plan changes
  item.schema.json   the shape of an item's JSON head
  check.mjs          checks the whole plan (node plan/check.mjs; --order prints build order)
  stages/<id>.md     one file per plan stage: its goal and its exit gate
  items/<id>.md      one file per item: JSON head, then prose
  ledger/            what v1 taught us, one row per lesson (L-... ids)
  cases/             real situations v1 handled, which v2 must pass (C-... ids)
  research/          what we read before deciding, with sources
  decisions/         two-way doors decided, and waiting-for-person.md for one-way doors
```

## How an item moves

Status runs `draft` → `ready` → `done` (off the path: `split`, `dropped`, `parked`), in four steps. A PR names its
item only by an `Item: <id>` line in its body; branch names are for people. Every commit ends with a `Claude-Session:`
trailer (`docs/gates.md`, "Sessions").

1. **Readying replan.** Fill the head until `check.mjs` passes with `ready`. Branch `replan/<topic>`, label `replan`,
   changes under `plan/` only, no `Item:` line.
2. **Build PR.** Branch `<kind>/<id>` (such as `build/journal-schema`), body with `Item: <id>`, which freezes the
   contract. Its first commit sets the status to `done` (and `done_on`); the verdict gate makes that true.
3. **Verdict.** A separate session, given the item's Verifier brief and not the builder's tests, writes its tests
   and evidence under `verify/<id>/` and commits `verify/<id>/verdict.json` to the build PR's branch.
4. **Merge and release.** Merge when `ci` and `verdict` are green at the head sha; to take main after the verdict,
   merge main in rather than rebase. A merge that changes `plugins/harness/` or `packages/journal/` is released
   (`docs/gates.md`, "After the merge"). No PR follows.

## How an item is written

An item file is a fenced `json` head following `item.schema.json`, then prose: the reasoning, the options considered
and a `## Verifier brief`, which adds only what the Expect lines' `how` fields leave out (setup, traps, what not to
read). The head is the contract; `check.mjs` refuses a `ready` item that leaves a field open.

| Field | Question it answers | Why v1 taught us to ask |
|---|---|---|
| `outcome`, `why`, `serves` | What is true when it's done, and which lessons does it serve? | The theory gets lost when only the code survives (Naur) |
| `inputs`, `outputs` | What does it read, and what does it hand on? | v1's builder→verifier handoff lived outside the machine |
| `expect` | How does someone else check it before accepting? | Post-landing steps in Expect forced person taps twice |
| `cases` | Which real v1 situations must it pass? | "On par" has to mean passing what v1 actually met |
| `concepts`, `non_goals` | How much does it add, and what won't it do? | 141 guards grew one reasonable check at a time |
| `records` | What does it log, so we can see it working? | v1 salvaged its own history after the fact |
| `person_prereqs` | What must the person do before the thread starts? | A thread can't add its own allow rules |
| `step_back` | When does it stop retrying and replan? Two rounds unless `max_rounds` says otherwise | PR #72 ran 5 rounds before anyone stepped back |
| `module`, `done_on` | Which module does a fix change, and when was it done? | Seven fixes in two days changed `actors.js` before anyone looked at its shape |
| `reader_effort` | What did the build cost its reader? Read it with `node scripts/reader-effort.mjs --item <id>` | The cleanups passed every gate while the harness grew |
| `contract_changes` | Did the contract move once the build started, and why? | A build that found a better shape could not take it |

## How slop is kept out

An item is done when the verifier, not the builder, shows its outcome holds (ledger L-proof-source). Five rules, each
enforced by something other than the builder (`docs/gates.md`), hold that up.

- **Every Expect line names its proof:** `world` (the real platform or GitHub shows it before accept), `verifier`
  (tests the verifier writes) or `builder` (the builder's tests). A ready build item has a `world` line, and at most
  half its lines are `builder`.
- **The contract names behaviour.** A check says what the harness does, in the words of `docs/language.md`, never what
  the repository's files equal today: `check.mjs` refuses a ready or doing item whose check holds a sha or a phrase
  in its `PINS` list (a new way of pinning main is one more entry). `ci` runs `npm test`, so no item repeats it.
- **The verdict names its tests.** Each `verifier` or `builder` result names the test file that proves it, and the
  verdict gate runs it at the head. What the verifier judged rather than ran goes in `observations`, which never
  gates. Evidence is what was shown: one small evidence file per Expect line, never a listing or a capture.
- **The contract changes once, then freezes.** Before its verdict file exists, one replan may change a doing item's
  contract, with a `## Contract change` section saying what the build tried and why the contract moved.
- **No stubs count as done.** No TODO, FIXME, "not implemented" or skipped test in `packages/` and `plugins/`.

## Changing the plan

A change is one file plus edges. Run `node plan/check.mjs` after it; `--coverage` lists ledger rows no item serves.

- **Ids are names, not numbers.** An id is a short slug (`obs-live-journal`). Order comes from `stage` and
  `depends_on`, never from an id, so inserting an item renumbers nothing.
- **To add an item,** write its file with `depends_on`, and add its id to the `depends_on` of what now needs it.
- **To split an item,** mark it `split` with `replaced_by` naming the new ids, and move its dependants to them.
- **To drop an item,** mark it `dropped` with the reason in `why`. Never delete the file: the reason is theory.
- **To add a plan stage,** write its file with an `order` between two existing ones (decimals, such as 2.5).

## Fix budget

`step_back` caps the rounds inside one item; the fix budget caps fixes across items, because a module that keeps
needing patches has the wrong design. A `fix-` item names the module (file or folder) its main change lands in, in
`module`, and its done date in `done_on`. When three fix items naming one module were done in the last 14 days with
no design item for it done after them, `check.mjs` refuses a fourth at `ready` or `doing`. The next item there is a
design item: not a fix, naming that module in `module`, the concept that keeps breaking in `concepts`, and designing
it twice with the tournament kit (`docs/tournaments.md`). Once it is done, the count starts again. The reasoning is in
`plan/decisions/2026-11-08-fix-budget-rule.md`.
