# left-reasons-hold

Command: `node --test verify/verify-regression-engine/left-reasons.test.mjs` at ad3d018, reading each left test with `git show 3862da5:verify/<suite>/<file>`.
Inputs: 32 cases, one per left file and per left half (by test title): kind source (reads a file, matches text, calls no head code outside string and regex literals), capture (names evidence/main, base-*.json, literals, base-/merge-workflows, committed brief.md), recorded (reads evidence/ or the adopt trial, calls no head code), listing (asserts counts), child (counts passes of test/journals-replay.test.mjs), ownOutput (the toy run's folders under verify/), finding.

Excerpt: 34/34 pass; every non-moved table row has a case; control: the moved two-hosts.test.mjs is none of these kinds.
Judged: the forge FINDING test drives inputsOfWake and asserts `[]`, but it is titled "observed, not asserted as good" and plan/decisions/2026-10-30-engine-effects.md keeps the `</event>` defect open; moving it would pin a bug, so it is left by intent (observations).
