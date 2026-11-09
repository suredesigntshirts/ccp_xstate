# scope

Command: `node --test verify/verify-regression-set/scope.test.mjs` at 9765a7792dfa85385f641f8f4f297485d3d25399.

Excerpt: `outside the retired folders, test/regression/ and the item: docs/traps.md`; docs/traps.md only drops the two example names of deleted test files; nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes. 3 pass, 0 fail.

Inputs: `git diff -M --name-status 57c9212ee74567ee28b59f31f274fa7e12f8fa3f 9765a7792dfa85385f641f8f4f297485d3d25399`.
