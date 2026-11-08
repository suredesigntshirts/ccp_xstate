# no-checkout-fetch

`node --test-reporter=tap verify/pinned-fetch-temp-repo/no-checkout-fetch.test.mjs` at 3f18736fc33c9739f66cee19d20b32af2e4c0bee, full clone.
origin(): temp bare repo fetched in full with HEAD 3f18736f, READY dd5fcc57, BASE 2178cc6c, `uploadpack.allowAnySHA1InWant true`;
`git clone --depth=1 --branch p0 file://<origin>` (no origin/main), node_modules symlinked; each suite run as
`node --test verify/<suite>/*.test.mjs` with NODE_TEST_CONTEXT, PR_BODY, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_LABELS removed.

Result: ok 1, exit 0, 235 s.

# head verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# head verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# head verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# head verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base verify/fix-trace-writes-clone-cwd: exit 1, pass 4, fail 1, skipped 0, first fail: the PR changes only the script, its test file and the item file
# base verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# base verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# base verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base files: .git/shallow now lists 8: 3862da54 3f18736f 43b4f45a 66e47a6a ad3d0184 af64a367 d9e142f7 e9ed7db2

The fresh clone's .git/shallow listed only 3f18736f and still did after each head suite. The base's four files (from
2178cc6c) fetched seven pinned commits into the clone. The base's fix-trace-writes-clone-cwd scope test failed in
that run; the line only needs the base files to deepen .git/shallow, so that failure is noted, not asserted.
