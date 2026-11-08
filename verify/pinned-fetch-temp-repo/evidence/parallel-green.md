# parallel-green: NOT MET

`node --test-reporter=tap verify/pinned-fetch-temp-repo/parallel-green.test.mjs` at 3f18736f, same origin and depth-1
clone as no-checkout-fetch; twelve `node --test --test-concurrency=1 verify/<suite>/*.test.mjs` processes started in
one Promise.all (three per suite), on a 4-core container.

Result: not ok 1, exit 1, 224 s.

# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 1, pass 51, fail 1, skipped 0, first fail: moved-bite run: test/regression/run/lifecycle-store.test.mjs goes red when store transition() no longer refuses a transi
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0

.git/shallow listed only the head at the end. Every fetch-reading test passed in all twelve runs. The failure, also seen
in 1 of 3 earlier trial runs (another trial without --test-concurrency=1 failed timing tests as well), is
`moved-bite run` in verify/verify-regression-engine/bite.test.mjs, which runs test/regression/run/lifecycle-store.test.mjs
in a scratch copy. That test writes fixed paths: `join(tmpdir(), 'regression-rls')` (rmSync'd per world) and
`join(tmpdir(), 'verify-rls-cont', 'root')`, so copies running at once in separate processes delete each other's roots.
It is not a fetch collision and is outside this item's outputs.

Reproduced alone: three `node --test-reporter=tap test/regression/run/lifecycle-store.test.mjs` started at once from
the head checkout (NODE_TEST_CONTEXT removed): exits 1, 0, 1, with "ENOTEMPTY: directory not empty, rmdir
'/tmp/regression-rls/returned'" and "Command failed: git -C /tmp/regression-rls/returned/repo add -A". Run alone it
passes 8/8. In plain `npm test` the same file and the bite's scratch copy of it can run at once, so ci can hit this too.
