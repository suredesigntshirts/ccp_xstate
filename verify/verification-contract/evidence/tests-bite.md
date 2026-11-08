# tests-bite

Command: `node --test verify/verification-contract/tests-bite.test.mjs` at 25dddc9. Each mutation is made in an
os.tmpdir() copy of plan/, scripts/, test/plan-check.test.mjs and package.json, never in the checkout.

Excerpt: Mutation 1: plan/check.mjs `const PINS = [ ...the ten phrases... ]` -> `const PINS = []`; ran
`node --test test/plan-check.test.mjs`: green 11/0, broken 10 pass 1 fail, restored 11/0.
Mutation 2: scripts/gates/lib.mjs `if (TESTED.includes(e.proof)) {` -> `if (false) {`; ran
`node --test scripts/gates/test/lib.test.mjs`: green 13/0, broken 12 pass 1 fail, restored 13/0.
(The item names scripts/gates/lib.test.mjs; the file is scripts/gates/test/lib.test.mjs.)
