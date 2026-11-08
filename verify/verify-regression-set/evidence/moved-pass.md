# moved-pass

Command: `node --test verify/verify-regression-set/moved-pass.test.mjs` at be4c72126ebb668b9a80272f388d26d93d55e232 (about 13 minutes here).

Excerpt: `as is: 76 files at once, 666 tests pass, fewest in one file 1`; `no Playwright: 76 files at once, 656 tests pass, fewest in one file 1`; the control shows the preload hides Playwright by name and by both install paths; every header names an Expect id its item has; no file reads the checkout's verify/. 6 pass, 0 fail.

Inputs: every file under test/regression/ started together, each in its own `node --test` child with NODE_TEST_CONTEXT dropped; the second run sets NODE_PATH to an empty temp folder and NODE_OPTIONS=--import=verify/verify-regression-set/no-playwright.mjs.
