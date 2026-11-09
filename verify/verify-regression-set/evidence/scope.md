# scope

Command: `node --test verify/verify-regression-set/scope.test.mjs` at 50295a0c424cfcb7c461ab144148334dbdc132a2.

Excerpt: `outside the retired folders, test/regression/ and the item: docs/traps.md`; docs/traps.md only drops the two example names of deleted test files; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes. 3 pass, 0 fail.

Inputs: `git diff -M --name-status 210533217518179e5d7d6e811b1352a1f1edd6e0 50295a0c424cfcb7c461ab144148334dbdc132a2`.
