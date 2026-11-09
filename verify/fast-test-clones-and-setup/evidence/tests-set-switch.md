# tests-set-switch

Command: `node --test verify/fast-test-clones-and-setup/tests-set-switch.test.mjs` at be40cff22a443e1d5be0f9dd0ac1cce00837e00b.

Excerpt: 1 pass. The 17 test files whose text, or a local module they import, names setup.sh, each run with its own
stub bash first on PATH (and BASH_ENV, for callers of /bin/bash): 44 setup.sh runs, all with CCP_SETUP_SKILLS=0
(setup-release 13, no-self-edit 9, setup 9, setup-install 5, clean-room run 3, clean-room regression 3, notice-behind 1,
session-start 1). No test asserts the skill's npm install. self-edit-check.test.mjs is left out: its runs are nested
runs of no-self-edit.test.mjs and test/setup.test.mjs.

At the earlier head 2f9f027a the same check gave 35 of 44 runs without the switch (only no-self-edit set it); the
builder fixed that in bc71a2d0.
