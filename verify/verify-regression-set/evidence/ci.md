# ci

Command: the PR's check runs at 50295a0c424cfcb7c461ab144148334dbdc132a2, read from GitHub.

Excerpt: ci test (job 128970018565): 2084 pass, 3 fail, all three this verifier's own tests as committed there, pinned to the earlier base 57c9212: table-complete's row comparison and left-reasons-hold's two case-coverage tests (no cases yet for stage-prompt-reader-gaps). Every other test passed, moved-pass among them. gates (job 128970018506) failed on the stale verdict. Both run again on this verdict commit, whose suite pins base 2105332 and head 50295a0.

Earlier: at ed38ae1 ci test was red (finish-ms.test.mjs read a deleted transcript, fixed by finish-ms-transcript-fixture); at 3586d71 against main a63da4c, capture-cheap-serial's suite was not retired and the all-at-once moved-pass starved two files on ci's 2-core runner.
