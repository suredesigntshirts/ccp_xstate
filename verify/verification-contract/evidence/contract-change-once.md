# contract-change-once

Command: `node --test verify/verification-contract/contract-change-once.test.mjs` at 25dddc9.
Inputs: a temp git repo with plan/items/vfy-doing.md (status doing) on main; branch replan/vfy-doing-contract with
one plan-only commit adding an Expect line; PR_LABELS='["replan"]'. Plan check: `node <temp>/plan/check.mjs`.

Excerpt: 7/7 pass. contract_changes 1 + `## Contract change`: freeze gate passed, plan ok. Same without the label:
freeze refused. contract_changes 2: plan check exit 1 naming vfy-doing and contract_changes (schema "must be at most
1"). 1 with no section: exit 1, "contract_changes is 1, so the item needs a ## Contract change section". verdict.json
at base, and at head: freeze exit 1, "changes the contract of vfy-doing ...; verify/vfy-doing/verdict.json exists, so
verification has started and nothing may change it". Status and done_on change with a verdict present: freeze
passed. Against main: 3 of 7 fail.
