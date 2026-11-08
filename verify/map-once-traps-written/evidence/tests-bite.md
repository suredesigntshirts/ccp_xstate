# tests-bite

Head d9e142f7dc7235d4c964a5c364bdf942afc76afb:

```
node --test --test-reporter=tap verify/map-once-traps-written/tests-bite.test.mjs
```

2/2 pass. The Layout table groups the scripts/ folders in one row, so the scripts/gates/ "row" is the clause
"`scripts/gates/` the PR gates; " in it. In a temp copy:

- clause removed: test/docs.test.mjs green 14/0, broken 13 pass 1 fail (output names scripts/gates), restored 14/0.
- whole `| \`scripts/\` |` row removed: 14/0, 13/1, 14/0.
