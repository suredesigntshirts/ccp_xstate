# no-checkout-fetch

`node --test-reporter=tap verify/pinned-fetch-temp-repo/no-checkout-fetch.test.mjs` at c761824bb4681ec79a7b644c965814cf0f16f191
(#247's build commit 3f18736f with main 1ffab492 merged in), from a full clone.

origin(): a temp bare repo holding c761824b, 3f18736f, 1ffab492, dd5fcc57 (readying replan) and 2178cc6c (main before
it) with history, `uploadpack.allowAnySHA1InWant true`, HEAD on a branch at c761824b. The clone is
`git clone --depth=1 --branch p0 file://<origin>` (no origin/main), node_modules symlinked from the checkout. Each
suite runs as `node --test verify/<suite>/*.test.mjs` with NODE_TEST_CONTEXT, PR_BODY, BASE_SHA, HEAD_SHA, PR_BRANCH,
PR_LABELS removed.

Result: ok 1, exit 0.

# head verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# head verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# head verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# head verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base verify/fix-trace-writes-clone-cwd: exit 0, pass 4, fail 0, skipped 1
# base verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# base verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# base verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base files: .git/shallow now lists 9: 3862da54 43b4f45a 66e47a6a 82c86117 ad3d0184 af64a367 c761824b d9e142f7 e9ed7db2

The fresh clone's .git/shallow listed only c761824b, and still did after each head suite, with no skipped test. With
the four files put back as they are at 2178cc6c, the same suites fetched eight pinned commits into the clone's
.git/shallow.

An earlier run at 3f18736f gave the same head result.
