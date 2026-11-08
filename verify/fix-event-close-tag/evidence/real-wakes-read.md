# real-wakes-read

At c2e8cba91c52147f95a18530e74103fec26f815b: `node --test verify/fix-event-close-tag/real-wakes.test.mjs` -> 7/7 pass.

For each of packages/engine/test/fixtures/wakes/{check-run-failed,check-suite-completed,pr-merged,tap-wake}.txt and
test/regression/fixtures/red-ci/delivered-wake.txt, `wakesIn` returns one wake whose `github` list, as { kind, data },
deep-equals the events read independently from the file (a line-anchored regex over each `<event source="github">`
line, optional comment line, JSON line, `</event>` line, JSON.parse'd). A guard test checks every fixture but
tap-wake has at least one such event, so the comparison is not empty. A timed fixture workflow item
(packages/engine/test/fixtures/workflows/timed) started in waiting has one timer; the one-line wake
`<wake reason="scheduled" current-time="<due + 1 min>"></wake>` is one wake from wakesIn and offers exactly one timer
input; the same wake at due - 1 min offers none.

These pass on main's wake.js too: this line guards that the fix kept real wakes, it is not the defect.
