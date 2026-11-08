# parallel-green

`node --test-reporter=tap verify/pinned-fetch-temp-repo/parallel-green.test.mjs` at 6ff276e3, with the same origin and
depth-1 clone as no-checkout-fetch. Twelve `node --test --test-concurrency=1 <suite files>` processes (three per suite)
start in one Promise.all on a 4-core container. Per the contract change (#257), the start-timing files are left out:
verify/test-fixture-edges/p95-over-bare.test.mjs and verify/verify-regression-engine/moved-pass.test.mjs.

The test was run twice in a row, and both runs gave ok 1, exit 0. The first:

# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 48, fail 0, skipped 0
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 48, fail 0, skipped 0
# verify/fix-trace-writes-clone-cwd: exit 0, pass 5, fail 0, skipped 0
# verify/test-fixture-edges: exit 0, pass 12, fail 0, skipped 0
# verify/map-once-traps-written: exit 0, pass 10, fail 0, skipped 0
# verify/verify-regression-engine: exit 0, pass 48, fail 0, skipped 0

In both runs, no output names shallow.lock, no test is skipped, and .git/shallow lists only the head at the end.

History: at 3f18736f, lifecycle-store's fixed tmpdir paths made the bite test fail. That was cleared by #232's
per-process paths, merged in at c761824b. At c761824b the line held in only 1 of 2 runs, because p95-over-bare failed
its timing bar under load. The contract change then took the timing tests out of the parallel run. No test that reads a
pinned commit has failed at any head.
