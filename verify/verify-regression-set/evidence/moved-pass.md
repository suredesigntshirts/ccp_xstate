# moved-pass

Command: `node --test verify/verify-regression-set/moved-pass.test.mjs` at 9765a7792dfa85385f641f8f4f297485d3d25399 (about 13 minutes here).

Excerpt: `as is: 76 files, 4 at a time, 666 tests pass, fewest in one file 1`; `no Playwright: 76 files, 4 at a time, 656 tests pass, fewest in one file 1`; the control shows the preload hides Playwright by name and by both install paths; every header names an Expect id its item has; no file reads the checkout's verify/. 6 pass, 0 fail.

Inputs: every file under test/regression/ in parallel, as many at a time as the machine has cores (all 76 together starved two files on ci's 2-core runner), each in its own `node --test` child with NODE_TEST_CONTEXT dropped; the second run sets NODE_PATH to an empty temp folder and NODE_OPTIONS=--import=verify/verify-regression-set/no-playwright.mjs.
