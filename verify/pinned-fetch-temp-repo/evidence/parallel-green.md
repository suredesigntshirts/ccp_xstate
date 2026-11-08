# parallel-green

`node --test-reporter=tap verify/pinned-fetch-temp-repo/parallel-green.test.mjs` at c761824b, with the same origin and
depth-1 clone as no-checkout-fetch. Twelve `node --test --test-concurrency=1 verify/<suite>/*.test.mjs` processes
(three per suite) start in one Promise.all on a 4-core container.

Result: ok 1, exit 0.

# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 52, fail 0, skipped 0

At the end, .git/shallow listed only the head.

At 3f18736f, before main was merged in, this was NOT MET. verify/verify-regression-engine/bite.test.mjs "moved-bite
run" failed in 2 of 3 runs. test/regression/run/lifecycle-store.test.mjs then wrote fixed paths under tmpdir()
(regression-rls, verify-rls-cont/root): three copies started at once exited 1, 0, 1 with "ENOTEMPTY ... rmdir
'/tmp/regression-rls/returned'". The main merged in at c761824b (#232) makes those paths per process. No fetch-reading
test failed in any of the runs.

A second run at c761824b failed: verify/test-fixture-edges/p95-over-bare.test.mjs "a 300 ms start delay on both spawns:
the cheap test passes at the head" went red on its median/p95 bar ("median 414 ms, of which a bare node start is
353 ms"). That is a timing test under twelve-way load, not a fetch. So at c761824b the line held in 1 of 2 runs, and no
verdict is committed while the line asks every test to pass.
