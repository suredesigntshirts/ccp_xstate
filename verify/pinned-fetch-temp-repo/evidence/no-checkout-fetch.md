# no-checkout-fetch

`node --test-reporter=tap verify/pinned-fetch-temp-repo/no-checkout-fetch.test.mjs` at 6ff276e37502a5b3a0e88b2835b31e9b1ff72702
(#247's build commit 3f18736f with main 34214872 merged in), from a full clone.

origin() makes a temp bare repo holding 6ff276e3, 3f18736f, 34214872, dd5fcc57 (the readying replan) and 2178cc6c (main
before it), with history and `uploadpack.allowAnySHA1InWant true`; its HEAD is a branch at 6ff276e3. The clone is
`git clone --depth=1 --branch p0 file://<origin>` (no origin/main), with node_modules symlinked from the checkout. Each
suite runs as `node --test` over its `*.test.mjs` files with NODE_TEST_CONTEXT, PR_BODY, BASE_SHA, HEAD_SHA,
PR_BRANCH and PR_LABELS removed.

Result: ok 1, exit 0.

# head verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# head verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# head verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# head verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base verify/fix-trace-writes-clone-cwd: exit 0, pass 4, fail 0, skipped 1
# base verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# base verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# base verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# base files: .git/shallow now lists 9: 3862da54 43b4f45a 66e47a6a 6ff276e3 82c86117 ad3d0184 af64a367 d9e142f7 e9ed7db2

The fresh clone's .git/shallow listed only 6ff276e3, and still did after each head suite, with no test skipped. With
the four files put back as they are at 2178cc6c, the same suites fetched eight pinned commits into the clone's
.git/shallow. Earlier runs at 3f18736f and c761824b gave the same head result.
