# Blind read: X vs Y

**planted-after-merge: about even, slight edge to X.** Both versions treat the live docs site as a post-merge non-goal and check `docs/index.md` instead, which is the key decision. They differ only on running with no name. X checks for exit 2 and that `usage: greet` appears on stderr. Y checks for exit 2 and empty stdout, so a PR that printed nothing at all to stderr would still pass Y.

**planted-bug-regression: X.** Both include a regression test that must fail against the old code. X runs the old `math.js` against the new test in a scratch copy using the merge base. Y overwrites the working tree with `main:math.js`, which assumes `main` is the base and depends on remembering to restore the file. X also checks the actual results of `add`, `subtract` and `multiply`. Y only checks that they are still functions.

**planted-half-rule: X.** Both catch the slugify gap in the README and check that every export has a heading. X adds `padLeft('7', 3, 'x') === 'xx7'`, which proves the fill character is actually used. Under Y, a builder who always pads with `'0'` passes every line. X also checks the outputs of the existing functions, not just that their tests still pass.

**planted-not-one-change: even.** Both block for the same correct reason, and they word it almost the same way.

**planted-shared-parser: Y.** Y's line on `src/parse.js` locks in the exported `parse()` behaviour: the comma default still works and the separator argument still works. That protects the shared parser, which is the trap in this case. Y also checks CRLF input and a mixed tab-and-comma input without the flag. X never checks `parse()` directly, so a change that breaks other callers could pass.

**planted-suggested-fix: slight edge to X.** Both reject "return {}" and give their reasons. X leaves it to the builder where the path gets added, and its grep checks are mechanical. Y requires the path inside `loadConfig`'s own error message, which narrows the fix without need. Y's line/column proof is also fuzzy ("e.g. 3:3", then reading the source). One risk in X: its regression proof names a fixed base commit (`799ce33`).

**real-jsonl-lint: X.** Y covers more, adding a CI check and required test cases. But every Y proof runs `npx jsonl-lint`. If the bin isn't linked, npx can download an unrelated package with that name from the npm registry and produce a false pass, or stop at an install prompt. X calls `node_modules/.bin/jsonl-lint` directly, works in fresh temp folders, and tests the torn last row on its own.

**Overall: X.** It wins three cases outright (bug-regression, half-rule, jsonl-lint) and has the edge in two more. Y wins only shared-parser, though that one decides real behaviour.
