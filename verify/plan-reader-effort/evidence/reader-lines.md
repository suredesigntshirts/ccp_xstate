# reader-lines

`node --test verify/plan-reader-effort/reader-lines.test.mjs` (5/5 pass). Temp repo, base src/util.mjs defines
`export function helper` (4 lines), `export const one = (x) => x;` (1 line), `export const arrow = (x) => {` (3
lines); src/main.mjs imports them; branch edits only src/main.mjs (and the files named).

| branch | expected (hunk lines + definitions) | reader_lines |
|---|---|---|
| helper(1); helper(2); const z = helper(3); in main.mjs, helper(4) in main.test.mjs | 3 + 1 + 4 once | 8 |
| one(1); arrow(2); | 2 + 1 + 3 | 6 |
| nosuch(1); alsoMissing(); | 2 + 0 | 2 |
| new src/fresh.mjs (3-line fresh), main.mjs adds 3-line local() plus fresh(); local(); | 3 + 5, no definition counted again | 8 |
| helper(1); plus 10-line evidence .md and a verdict.json whose lines contain helper( | 1 + 4 (evidence added 11, not counted) | 5 |
