# tests-bite

Command: `node --test verify/rules-said-once/tests-bite.test.mjs` at d6df5a7. Each case works in a temp copy (texts, plan/, docs/, test/ copied, other top-level entries symlinked; for lib.test.mjs, scripts/ and package.json copied), runs the named test green, breaks it, runs it red, restores, runs it green.

- rename docs/gates.md (CLAUDE.md names it) -> test/docs.test.mjs red
- CLAUDE.md `docs/layout.md` -> `docs/layouts.md` -> red
- pad docs/gates.md by (230 - total) lines -> red
- namedItem: `const item = body.match(...)?.[1] ?? null` -> `?? (ids.has(branch.split('/').pop()) ? branch.split('/').pop() : null)` with a `branch` parameter -> scripts/gates/test/lib.test.mjs red

```
ok 1 - docs.test.mjs goes red when a path CLAUDE.md names is renamed
# green {"pass":12,"fail":0}, broken {"pass":7,"fail":5}, restored {"pass":12,"fail":0}
ok 2 - docs.test.mjs goes red when CLAUDE.md names a path that is not there
# green {"pass":12,"fail":0}, broken {"pass":11,"fail":1}, restored {"pass":12,"fail":0}
ok 3 - docs.test.mjs goes red when the three entry texts reach 230 lines
# green {"pass":12,"fail":0}, broken {"pass":11,"fail":1}, restored {"pass":12,"fail":0}
# padded from 227 to 230 lines
ok 4 - lib.test.mjs goes red when namedItem reads the branch last segment again
# green {"pass":15,"fail":0}, broken {"pass":14,"fail":1}, restored {"pass":15,"fail":0}
# tests 4
# pass 4
# fail 0
```
