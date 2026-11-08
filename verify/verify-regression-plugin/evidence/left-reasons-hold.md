# left-reasons-hold

Command: `node --test verify/verify-regression-plugin/left-reasons.test.mjs` at head db2ba7ec736ea81865f13c8833118f992b8dba1f, reading each left test at base e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4.

Excerpt: 45/45 pass. 41 cases cover the 17 left files (every test in them) and the left half of all 16 split rows. Each is one of: capture (compares with main's stored answers or a stored page/run output: main-scenarios.json, main-prompts.json, main-refusals.json, main/answers.json, browser-check output, published-index.html), recorded (asserts recorded rows, transcripts or wakes and runs no head code), source (matches docs or source text and runs no head code), retired (runs only with /home/user/lanes, /mnt/project-files or VERIFY_MAIN). A control shows the moved fix-waiting-run-stall/block tests are none of these kinds. No left test drove the head and asserted without a capture; disagreements are in observations.

Inputs: base text via `git show e9ed7db2dc1fb0c601583fcd43dd102eb2ba0ea4:verify/<suite>/<file>`.
