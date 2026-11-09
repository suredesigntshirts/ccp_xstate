# no-verify-in-npm-test

Command: node --test verify/regression-set-leftovers/no-verify-in-npm-test.test.mjs; and npm test in fresh clones at
base 23cbd22c and head fa9c1957 (npm ci, 4 cores), with a NODE_OPTIONS --import preload logging each process's entry
file, keeping the ones the two passes started (execArgv holding the ^cheap: pattern).

Excerpt: the test, 3 pass: the head's two passes expand to 188 files, none under verify/ (14 verify/ test files on
disk); every test file under the four roots in the head tree is started; the base script's 200 files less its 14 under
verify/ are all started at the head, which adds lean-clone and setup-skills-switch. The real runs agree: base started
200 files (14 under verify/), 2114 tests pass, 725 s; head started 188 files (0 under verify/), 1963 tests pass, 318 s;
no file outside verify/ that the base started is missing at the head.
