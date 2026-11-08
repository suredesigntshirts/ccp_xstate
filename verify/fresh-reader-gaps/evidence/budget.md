# budget

`node --test verify/fresh-reader-gaps/budget.test.mjs` at build head `7d35231e`: 2/2 pass.

- test/docs.test.mjs: `const BUDGET = 225;` over `ENTRY = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md']`, test
  "fewer than ${BUDGET} lines together".
- Counts: CLAUDE.md 56, plan/README.md 93, docs/gates.md 75; total 224 (< 225).
- `node --test test/docs.test.mjs`: exit 0.
