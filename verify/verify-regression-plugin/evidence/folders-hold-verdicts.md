# folders-hold-verdicts

Command: `node --test verify/verify-regression-plugin/folders.test.mjs` at head db2ba7ec736ea81865f13c8833118f992b8dba1f.

Excerpt: 2/2 pass. Each of the 19 folders holds only verdict.json, whose `item` is the folder name. At the base the main test fails (the folders still hold tests and evidence).

Inputs: the working tree at the head.
