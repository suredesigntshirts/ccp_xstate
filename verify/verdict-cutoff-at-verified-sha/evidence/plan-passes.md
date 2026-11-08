# plan-passes

Command: `node --test verify/verdict-cutoff-at-verified-sha/plan-passes.test.mjs` at 5005ddad872eb02941838cd88ceb900dbd7ef49a; PR mode with
`BASE_SHA=origin/main PR_BODY="Item: verdict-cutoff-at-verified-sha"` (as the verdict job sets them).

Excerpt (2/2 pass in both modes): "8 stages, 96 items (85 live), 90 ledger rows, 17 cases / plan ok". PR mode: 7 files,
docs/gates.md, docs/language.md, plan/items/verdict-cutoff-at-verified-sha.md, scripts/gates/lib.mjs,
scripts/gates/pr-gate.mjs, scripts/gates/test/lib.test.mjs, scripts/gates/test/pr-gate.test.mjs, plus this folder; no
other item's verify/ folder. Depth-1 mode: the outputs list equals the allowed code files, all present. All 23 tests
of this folder also pass in a `git clone --depth 1` with no origin/main and no BASE_SHA.
