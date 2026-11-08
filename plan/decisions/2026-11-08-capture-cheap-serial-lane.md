# Capture's cheap test runs in a serial lane

**Date:** 2026-11-08, by the builder of verify-regression-plugin, at the coordinator's request, on the person's
standing instruction to decide two-way doors and not wait.

**What broke.** `plugins/harness/test/capture.test.mjs`'s cheap test reads hook.run `ms`, which is wall time from the
hook process's start. `npm test` runs every test file at once, so on a busy runner capture's own work slows with
everything else. It went red on main loads and on #251 (p95 348 ms over a 26 ms bare start). In a local run beside the
regression set's suites, measuring the hook and a bare start in pairs still failed 4 of 12 runs, because capture's CPU
work grows with load and the bare start does not.

**Choice:** a serial lane. The cheap test runs alone after the parallel pass, so it measures capture on a quiet machine,
which is what `2026-10-30-capture-cheap-measures-what-capture-adds.md` meant by "what capture adds". The bars do not
change.

**Why not CPU time?** `process.cpuUsage()` in the hook would ignore load, but it is not what the person waits for: a
tool call is slowed by wall time. Recording a CPU figure would also change hook.run rows, and with them the journal
format and a release. A serial lane changes only how the suite runs.

**What it costs:** the suite takes a few seconds longer, because the cheap test no longer overlaps the rest. Reversible:
the test can rejoin the parallel pass at any time.
