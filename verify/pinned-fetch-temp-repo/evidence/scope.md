# scope

`node --test-reporter=tap verify/pinned-fetch-temp-repo/scope.test.mjs` at 3f18736f: 2/2 pass, in the full clone and in
a `--depth=1` clone whose origin is GitHub (the pinned commits fetched into a temp bare repo; the clone's .git/shallow
still listed only 3f18736f after, and it has no origin/main).

git diff --name-only dd5fcc57..3f18736f (build over its readying replan #246):
- docs/traps.md
- plan/items/pinned-fetch-temp-repo.md
- verify/fix-trace-writes-clone-cwd/lib.mjs
- verify/map-once-traps-written/suite-and-scope.test.mjs
- verify/test-fixture-edges/scope.test.mjs
- verify/verify-regression-engine/lib.mjs

Against 2178cc6c (main before #246 merged) the only extra file is plan/items/verify-regression-set.md, from the replan.
No verdict.json or evidence file under verify/ changes.
