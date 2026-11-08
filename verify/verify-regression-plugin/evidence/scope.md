# scope

Command: `node --test verify/verify-regression-plugin/scope.test.mjs` at head db2ba7ec736ea81865f13c8833118f992b8dba1f; `git diff -M --name-status e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4 db2ba7ec736ea81865f13c8833118f992b8dba1f`.

Excerpt: 3/3 pass. `# outside the 19 folders: verify/rules-said-once/suite-and-scope.test.mjs; 129 deleted, 34 renamed`. That file's only change drops one line, `assert.doesNotMatch(read(TRIMMED[0]), /CLAUDE\.md/ ...)`, where TRIMMED[0] is verify/harness-glossary/notes.test.mjs, which this PR deletes. Nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes. verify/verify-regression-plugin/ (the verifier's commits) is not counted as the build's.

Inputs: BASE and VERIFIED pinned in lib.mjs.
