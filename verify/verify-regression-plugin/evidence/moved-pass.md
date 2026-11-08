# moved-pass

Command: `node --test verify/verify-regression-plugin/moved-pass.test.mjs` at head db2ba7ec736ea81865f13c8833118f992b8dba1f, twice: as is, and with Playwright hidden as in CI (`unshare -m` with tmpfs over /opt/node-tools/node_modules/playwright and /opt/node22/lib/node_modules/playwright; `require('playwright')` then fails).

Excerpt: 4/4 pass both times. As is: `# 49 files, 343 tests pass`. Playwright hidden: `# 49 files, 333 tests pass`; test/regression/inspector/stage-record.test.mjs alone passes 1 and skips 8. Every first comment names `Expect: <item>/<id>` lines present in plan/items/; no code file under test/regression/ names a verify/ path.

History: at 142b5ac stage-record.test.mjs passed 0 in CI (all 5 tests skipped without Playwright), which failed this line and verify/verify-regression-engine/moved-pass.test.mjs in ci run 42474983356. 720d09b added a browserless test; fixed.

Inputs: each file run alone as `node --test --test-reporter=tap <file>` with NODE_TEST_CONTEXT dropped.
