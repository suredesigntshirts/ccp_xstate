# left-reasons-hold

Command: `node --test verify/verify-regression-plugin/left-reasons.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf, reading each left test at base 2178cc6c0e9b86456c7dc35fd352b16952356bf1.

Excerpt: 46/46 pass. 42 cases cover the 17 left files (every test in them) and the left half of all 16 split rows. Each is one of: capture (compares with main's stored answers or a stored page/run output: main-scenarios.json, main-prompts.json, main-refusals.json, main/answers.json, browser-check output, published-index.html), recorded (asserts recorded rows, transcripts or wakes and runs no head code), source (matches docs or source text and runs no head code), retired (runs only with /home/user/lanes, /mnt/project-files or VERIFY_MAIN), or heldElsewhere (obs-live-capture cheap: the same median and p95 bars over a bare node start are asserted by plugins/harness/test/capture.test.mjs at the head, and the row names that file; the leave reason added by contract change #245). A control shows the moved fix-waiting-run-stall/block tests are none of these kinds. No left test drove the head and asserted without a capture; disagreements are in observations.

Inputs: base text via `git show 2178cc6c0e9b86456c7dc35fd352b16952356bf1:verify/<suite>/<file>`.
