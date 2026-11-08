# tests-bite

`node --test verify/plan-reader-effort/tests-bite.test.mjs` (1/1 pass). Temp dir: scripts/ copied, every other
top-level entry of the checkout symlinked. Mutation: `return 'code';` inserted as the first line of
`export function category(path)` in the copy's scripts/reader-effort.mjs; run
`node --test --test-reporter=tap scripts/reader-effort.test.mjs` before, broken, restored.

green 6 pass 0 fail; broken 2 pass 4 fail; restored 6 pass 0 fail. Red tests: "each path falls in the category its
first matching rule gives", "a merged PR is read as its merge against the first parent, by number or by range",
"exports added and removed are counted in code files only", "reader lines are the hunks plus each called definition
once, never evidence".
