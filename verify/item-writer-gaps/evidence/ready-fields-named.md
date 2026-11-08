# ready-fields-named

At the build head ae70217b923d39bba381423bcafba64ae3cda3ea, from the checkout root, no environment set:

```
node --test verify/item-writer-gaps/ready-fields-named.test.mjs
```

Each run makes its own temp copy (os.tmpdir(), removed after). What it printed:

```
Subtest: How an item is written says the plan check refuses an open readyRequired field and names it
The head is the contract; `check.mjs` refuses a `ready` item that leaves open a field the schema's `readyRequired` names, and names the field.
Subtest: each readyRequired field, left empty or out of a ready item, is refused by name
readyRequired: why, serves, inputs, outputs, expect, concepts, non_goals, records
why absent: exit 1, items/iwg-open.md: ready, but why is empty
serves absent: exit 1, items/iwg-open.md: ready, but serves is empty
inputs absent: exit 1, items/iwg-open.md: ready, but inputs is empty
outputs absent: exit 1, items/iwg-open.md: ready, but outputs is empty
expect absent: exit 1, items/iwg-open.md: ready, but expect is empty
concepts absent: exit 1, items/iwg-open.md: ready, but concepts is empty
non_goals absent: exit 1, items/iwg-open.md: ready, but non_goals is empty
records absent: exit 1, items/iwg-open.md: ready, but records is empty
Subtest: Changing the plan says depends_on never points at a later stage
**To add an item,** write it with `depends_on` (none in a later stage), then list it in its dependants' `depends_on`.
Subtest: the plan check refuses a dependency in a later stage and passes one in the same stage
depends on verifier-reader-gaps (s5-parity): exit 0
depends on decide-v1-retirement (s6-retire-v1): exit 1, items/iwg-dep.md: depends on decide-v1-retirement, which is in a later stage
tests 4
pass 4
fail 0
```
