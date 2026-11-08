# trap-written

`node --test-reporter=tap verify/pinned-fetch-temp-repo/trap-written.test.mjs` at 6ff276e3: ok 1.

The "Clones can be shallow" entry now reads: "A test that needs a pinned commit fetches it at depth 1 into a temp bare
repo and reads it there, never into the checkout: `npm test` runs suites in parallel, and fetches into one shallow repo
collide on `.git/shallow.lock`; `verify/item-head-trim/scope.test.mjs` does this." At main 2178cc6c the entry has no
"pinned commit" sentence, so the test fails there.
