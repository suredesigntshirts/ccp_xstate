# scope

Command: `node --test verify/verify-regression-set/scope.test.mjs` at be4c72126ebb668b9a80272f388d26d93d55e232.

Excerpt: `outside the retired folders, test/regression/ and the item: docs/traps.md`; docs/traps.md only drops the two example names of deleted test files; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes. 3 pass, 0 fail.

Inputs: `git diff -M --name-status dcb4c7efd3c24017dacc3c83ea55911cf33f7241 be4c72126ebb668b9a80272f388d26d93d55e232`.
