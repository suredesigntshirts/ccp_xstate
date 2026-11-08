# one-helper

Command: `node --test verify/verify-regression-plugin/one-helper.test.mjs` at head a95b6c80e7d567730376ca743833154514212acf.

Excerpt: 3/3 pass. test/regression/lib.mjs is the only .mjs/.js/.cjs file under test/regression/ that is not a `*.test.mjs`; each of its exports is imported by at least two test files (static, destructured dynamic and namespace imports counted); the parser control sees every form.

Inputs: the working tree at the head.
