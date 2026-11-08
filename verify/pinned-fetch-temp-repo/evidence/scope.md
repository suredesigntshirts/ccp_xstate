# scope

`node --test-reporter=tap verify/pinned-fetch-temp-repo/scope.test.mjs` at 6ff276e3: 3/3 pass, in the full clone and in
a `--depth=1` clone whose origin is GitHub (the pinned commits fetched into a temp bare repo; the clone's .git/shallow
still listed only its head after, and it has no origin/main).

git diff --name-only dd5fcc57..3f18736f (the build's own commits over its readying replan #246), and
34214872..6ff276e3 (the head over the main merged into it) give the same six files:
- docs/traps.md
- plan/items/pinned-fetch-temp-repo.md
- verify/fix-trace-writes-clone-cwd/lib.mjs
- verify/map-once-traps-written/suite-and-scope.test.mjs
- verify/test-fixture-edges/scope.test.mjs
- verify/verify-regression-engine/lib.mjs

Against 2178cc6c (main before #246 merged) the only extra file is plan/items/verify-regression-set.md, from the replan.
No verdict.json or evidence file under verify/ changes.
