# scope

Command: `node --test verify/verify-regression-plugin/scope.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf; `git diff -M --name-status 2178cc6c0e9b86456c7dc35fd352b16952356bf1 a95b6c80e7d567730376ca743833154514212acf`.

Excerpt: 3/3 pass. `# outside the 19 folders: verify/rules-said-once/suite-and-scope.test.mjs; 129 deleted, 34 renamed`. That file's only change drops one line, `assert.doesNotMatch(read(TRIMMED[0]), /CLAUDE\.md/ ...)`, where TRIMMED[0] is verify/harness-glossary/notes.test.mjs, which this PR deletes. Nothing under packages/, plugins/, workflows/, scripts/ or bench/ changes. verify/verify-regression-plugin/ (the verifier's commits) is not counted as the build's.

Inputs: BASE and VERIFIED pinned in lib.mjs.
