# folders-hold-verdicts

Command: `node --test verify/verify-regression-plugin/folders.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf.

Excerpt: 2/2 pass. Each of the 19 folders holds only verdict.json, whose `item` is the folder name. At the base the main test fails (the folders still hold tests and evidence).

Inputs: the working tree at the head.
