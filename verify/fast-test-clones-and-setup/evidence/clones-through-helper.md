# clones-through-helper

Command: `node --test verify/fast-test-clones-and-setup/clones-through-helper.test.mjs` at be40cff22a443e1d5be0f9dd0ac1cce00837e00b.

Excerpt: 3 pass. Every git clone call in the .js/.mjs files under test/, scripts/, packages/ and plugins/ (comments
aside): 12 calls, 1 the helper's own, 2 bare (no-self-edit's bare origin of the repo; the bench's bare cache of a case
repo), 9 of temp repos the same file builds with git init (setup-release's origin, the three engine regression files'
origins and seeds, actors.test.js's rebuilt origin, the bench case repo's cache). 7 leanClone calls take REPO, ROOT,
or no-self-edit's bare origin. The third test checks the reader would flag a plain clone of REPO.

Read by hand as well: git worktree add of the repo in test/regression/inspector/reads-records.test.mjs is not a clone
(see observations).
