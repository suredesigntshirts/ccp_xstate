# main-runs-all

Command: node --test verify/pr-test-selection/main-runs-all.test.mjs

Excerpt: 3 pass at 5d758cf5. ci.yml triggers on pull_request and on push to [main]; the one step that runs
`npm test` has `if: github.event_name != 'pull_request'`, the one step that runs scripts/ci/pr-tests.mjs has
`if: github.event_name == 'pull_request'`, and no other step runs tests. npm test's first pass globs
test/**/*.test.mjs, scripts/**/*.test.mjs, packages/**/*.test.{js,mjs} and plugins/**/*.test.{js,mjs} with no
name filter, and every guard file the selector lists matches one of them.

Not yet seen: a main run after this PR merges (main has not run this ci.yml). The builder should look at the first
main run after merge and check it printed npm test's full count, not a selection.
