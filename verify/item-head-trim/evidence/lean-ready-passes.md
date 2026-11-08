# lean-ready-passes

Sha: ec2090105e18670277bb2e4f513c909508edef64. Command: `node --test verify/item-head-trim/lean-ready-passes.test.mjs`.

The test copies the head's whole `plan/` to a temp folder, writes `plan/items/<id>.md` from `item-head-trim.md` with
the id changed, `status` set to `ready`, and `verifier` and `step_back` deleted (prose, including the Verifier brief,
kept), then runs the copy's `check.mjs`.

```
✔ a ready build head with no verifier and no step_back passes the plan check
ℹ fields: id, title, stage, kind, status, outcome, why, serves, depends_on, inputs, outputs, expect, concepts, non_goals, records
ℹ exit 0: 8 stages, 99 items (88 live), 90 ledger rows, 17 cases | plan ok
✔ the same lean head with expect emptied is refused, naming expect
ℹ exit 1: items/iht-no-expect.md: ready, but expect is empty | items/iht-no-expect.md: a ready build item needs an Expect line with proof world
✔ the same lean head with outputs emptied is refused, naming outputs
ℹ exit 1: items/iht-no-outputs.md: ready, but outputs is empty
✔ the same lean head with why emptied is refused, naming why
ℹ exit 1: items/iht-no-why.md: ready, but why is empty
```

Control, by hand: the same lean head on a plan copy with main's `plan/item.schema.json` (at a4e3a59d) exits 1 with
`items/iht-lean.md: ready, but step_back is empty` and `items/iht-lean.md: ready, but verifier is empty`.
