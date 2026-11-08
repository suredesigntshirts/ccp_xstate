# map-complete

Head d9e142f7dc7235d4c964a5c364bdf942afc76afb, after `npm ci`:

```
node --test --test-reporter=tap verify/map-once-traps-written/map-complete.test.mjs
```

4/4 pass. 21 folders found on disk (.github, bench, docs, infra, packages, plan, plugins, probes, scripts, test,
tournaments, vendor, verify, workflows, and scripts/{bench,clean-room,debug,gates,inspector,release,tournament}), every
one named in backticks in a row of CLAUDE.md's Layout table. docs/layout.md has no fenced block and keeps Tests,
Comments and Dependencies. test/docs.test.mjs passes 14/0. In a temp copy (CLAUDE.md, plan, docs, test, scripts
copied, the rest linked) with `scripts/x/a.mjs` added: 13 pass, 1 fail, output names `scripts/x`.

Against the base 43b4f45 (MOT_REPO=<clone at 43b4f45>): tests 1, 2 and 4 fail; the map missed .github, infra, probes,
scripts, scripts/clean-room, scripts/inspector, scripts/release, and docs/layout.md held its fenced tree.

The same file passes in a depth-1 clone of the head.
