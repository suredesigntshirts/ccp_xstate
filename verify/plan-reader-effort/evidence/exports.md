# exports

`node --test verify/plan-reader-effort/exports.test.mjs` (2/2 pass). Temp repo, base: src/lib.mjs (`export function
old`, `export const keep`), src/util.js, src/lib.test.mjs, verify/toy/helpers.mjs. Branch: src/lib.mjs replaces
`old` with `export function added` and adds `export const C1`; src/util.js adds `export { a as b }` and
`export default stays`; the test file adds `export function testHelper`, `export const T`; verifier files add
`export function verifierHelper`, `export default 3`, `export const w`.

Range and `12` (merge "Merge pull request #12 from x/exports") both: exports_added 4, exports_removed 1.
A branch changing only the test and verifier files: 0 and 0.
