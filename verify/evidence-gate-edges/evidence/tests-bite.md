# tests-bite

Command: `node --test verify/evidence-gate-edges/tests-bite.test.mjs` at 10dad10eaa0cb475756403011bb41923694d092c. Each case copies scripts/ and
package.json to a temp dir, runs the named test file with `--test-reporter=tap`, breaks one rule, runs it again,
restores it and runs it a third time.

Excerpt: 3 tests, 3 pass.

- lib.mjs `if (!REGULAR.has(mode))` -> `if (false)`; scripts/gates/test/lib.test.mjs: green 20/0, broken 19 pass 1 fail, restored 20/0.
- lib.mjs isListing's `return has('pass') && has('fail') && results >= LISTING_LINES;` -> `return false;`; lib.test.mjs: 20/0, 19/1, 20/0.
- pr-gate.mjs `const mode = git('ls-tree', head, '--', path).split(/\s/)[0];` -> `const mode = undefined;`;
  scripts/gates/test/pr-gate.test.mjs: green 13/0, broken 11 pass 2 fail, restored 13/0.
