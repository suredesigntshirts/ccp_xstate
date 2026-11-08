# rules-written

Command: `node --test verify/verification-contract/rules-written.test.mjs` at 25dddc9, and a read of the four files.

Excerpt: 5/5 pass. plan/README.md "How slop is kept out": "check.mjs refuses a ready or doing item whose check holds
a sha or a phrase that pins main (... the rest of the list in plan/decisions/2026-11-08-verification-swing.md,
decision 1)"; "names in `test` the file that proves it; the verdict gate runs that file at the head"; "`observations`,
which never gates"; "Once an item's verification starts, nothing changes its head or Verifier brief. Before that, one
replan may, with a `## Contract change` section"; "once `verify/<item>/verdict.json` exists at the PR's base or head";
head table row `contract_changes`. docs/gates.md verdict example parses as JSON with `test`, `test_name` and
`observations`; freeze section "Verification has started once ... from then on the gate refuses any head or brief
change, label or not". CLAUDE.md: decision 4's text verbatim, old text gone, 60 lines. docs/language.md rows plan
verifier, observation, contract change, regression set; "Say *plan verifier* wherever the model stage could be meant".
Against main: 5 of 5 fail.
