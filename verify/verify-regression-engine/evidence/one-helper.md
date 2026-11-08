# one-helper

Command: `node --test verify/verify-regression-engine/one-helper.test.mjs` at ad3d018.
Inputs: the files under test/regression/; import forms parsed: `import { }`, `const { } = await import()`, `import * as`.

Excerpt: 3/3 pass. The only non-test code file is test/regression/lib.mjs; its 17 exports each have >= 2 importing test files (fewest 2). Parser control passes. At the base: fails (no lib.mjs).
