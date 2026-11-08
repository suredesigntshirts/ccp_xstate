# The cheap test reads p95 over a bare node start too

**Date:** 2026-11-08, by the builder of test-fixture-edges, on the person's standing instruction to decide two-way
doors and not wait.

**What broke.** `plugins/harness/test/capture.test.mjs`'s cheap test read the median of `hook.run` `ms` over a bare
node start (`2026-10-30-capture-cheap-measures-what-capture-adds.md`) but held p95 to an absolute 200 ms. With five
PostToolUse runs, p95 is the slowest one, and `ms` counts from the process's start, so one slow node start on a busy
runner failed it: 514 ms on the ci of self-edit-check-snapshot's verdict head, once the no-self-edit tests stopped
skipping on CI and the suite got busier.

**Choice:** p95 is read the way the median is: the p95 of `hook.run` `ms` minus the p95 of fifteen bare node starts
measured the same way, in the same test, must be at most 200 ms. The median bar (50 ms over the bare median) and
obs-live-capture's Expect line do not change.

**Why not more samples or a higher bar?** A higher absolute number still mixes Node's start with capture's work. More
fixture runs make the test slower and still leave the slowest start deciding when it is an outlier of the runner.
Subtracting the same quantile of the baseline keeps the bar on what capture adds, as the median already does.

**What it costs:** on a runner whose starts vary a lot, the bar is looser, by the spread of the bare starts' slowest
run. A capture that adds over 200 ms to one tool call still fails it. Reversible: the test can go back to the absolute
bar at any time.
