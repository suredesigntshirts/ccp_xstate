# ci

Command: the PR's check runs at 9765a7792dfa85385f641f8f4f297485d3d25399, read from GitHub.

Excerpt: ci test (job 128954339328): 1966 pass, 3 fail. The three are this verifier's own tests as committed at d370c5c, pinned to the earlier base dcb4c7e: table-complete's row comparison, and left-reasons-hold's two case-coverage tests (no cases yet for capture-cheap-serial). Every other test passed, the regression set's moved-pass among them. gates (job 128954339213) failed on the stale verdict. Both run again on this verdict commit, whose suite pins base 57c9212 and head 9765a77.

Earlier: at ed38ae1 ci test was red (finish-ms.test.mjs read a deleted transcript, fixed by finish-ms-transcript-fixture); at 3586d71 against main a63da4c, capture-cheap-serial's suite was not retired and the all-at-once moved-pass starved two files on ci's 2-core runner.
