# one-suite-command

`node --test verify/fresh-reader-gaps/one-suite-command.test.mjs` at build head `7d35231e`: 3/3 pass.

- CLAUDE.md, Commands: `node --test "verify/<item>/*.test.mjs"   # one suite: name its files, a bare folder fails`.
- That command with `<item>` = `item-head-trim`, run from the checkout's root: exit 0, tests 8, pass 8, fail 0 over
  the folder's 4 test files.
- `node --test verify/item-head-trim/`: exit 1, `Error: Cannot find module '<repo>/verify/item-head-trim'` (Node
  22.23.4).
