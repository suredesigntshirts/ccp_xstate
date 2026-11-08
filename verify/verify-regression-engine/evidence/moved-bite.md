# moved-bite

Command: `node --test verify/verify-regression-engine/bite.test.mjs` at ad3d018. Copies the working tree (no .git, no verify/) to os.tmpdir(), edits one file, runs the moved test, restores, runs again.

| area | test | edit | broken | restored |
|---|---|---|---|---|
| engine | engine/quick-fix-cases.test.mjs | workflows/quick-fix.json verifiedHead: drop `{ "path": "context.verdict.pr.at", "same": "context.pr.at" }` | 2 red (C-verdict-on-old-head, C-push-after-pass) | 7 pass |
| run | run/lifecycle-store.test.mjs | packages/engine/src/run/store.js transition(): drop `if (!t.from.includes(state(root, run))) return false;` | 1 red (states-true: a transition from a state it does not leave from writes nothing) | 8 pass |
| marks | marks/declared-marks.test.mjs | packages/engine/src/stages.js checkMarks: `if (!words(node).includes(value)) bad(` -> `if (false) bad(` | 5 red (marks-checked refusals, declared-rules-hold other words) | 24 pass |

Tried first and not caught: adding 'returned' to TRANSITIONS.fail.from (the test reads TRANSITIONS itself), so the guard was broken instead.
