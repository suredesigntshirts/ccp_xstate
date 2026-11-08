# moved-bite

Command: `node --test verify/verify-regression-plugin/bite.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf. It copies the head (minus .git and verify/) to a temp folder, makes one edit, runs the test file there, restores and runs it again.

Excerpt: 3/3 pass.
- plugin: plugins/harness/scripts/return-tool.mjs `if (same) {` -> `if (stored) {` (accepted for any result once one is stored): test/regression/plugin/return-tool-answer.test.mjs 2 red (still-refuses), restored 4 pass.
- inspector: plugins/harness/pages/observe/data.js lastFinishes keeps every agent.finish row (`new Set(rows)`): test/regression/inspector/item-views.test.mjs 6 red (finish-once), restored 9 pass.
- journal: packages/journal/src/check.js treats every transcript call as journalled (`if (true) continue;`): test/regression/journal/journal-check.test.mjs 3 red (session-diff), restored 10 pass.

Inputs: the temp folder is removed after; the edits are the CASES in bite.test.mjs.
