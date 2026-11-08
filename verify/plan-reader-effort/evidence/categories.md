# categories

`node --test verify/plan-reader-effort/categories.test.mjs` (3/3 pass at the verified sha). Temp git repo: a base
commit of 8 files, branch `feature` changing 15 paths, merged `--no-ff -m "Merge pull request #7 from x/feature"`,
then a later `#70` merge to make sure `7` doesn't pick `#70`. Expected numbers come from the decision's section 2 by
hand (fixture comments in the test list each file's category):

- code: src/app.mjs +3 -1, workflows/quick-fix/plan.md +2 -2, packages/engine/messages.md +1, src/config.json +4, src/old.mjs deleted -4
- tests: src/app.test.mjs +2 -1, test/helpers/x.mjs +3, packages/engine/fixtures/sample.txt +1
- verifier: verify/toy/a.test.mjs +4, verify/toy/lib.mjs +2
- evidence: verify/toy/evidence/e.md +5 -2, verify/toy/verdict.json +3, verify/toy/notes.md +1
- docs: docs/note.md +1 -3, README.md +2

Output of `reader-effort.mjs 7 --json` (identical to the `base..merge` range apart from `pr`):
{"pr":7,"files":15,"exports_added":0,"exports_removed":0,"reader_lines":36,"added":{"code":10,"tests":6,"verifier":6,"evidence":9,"docs":3},"removed":{"code":7,"tests":1,"verifier":0,"evidence":2,"docs":3}}
