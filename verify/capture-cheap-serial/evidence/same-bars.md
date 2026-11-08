# same-bars

Test: `node --test verify/capture-cheap-serial/same-bars.test.mjs` (2 tests).

Read at the base c33644a28c3523bf65edcb6e9023dac1e194ca75 (the build's parent) and pinned in lib.mjs, since ci's
depth-1 checkout lacks it:

- `git show c33644a2:plugins/harness/test/capture.test.mjs | awk "/^test\('cheap: /,/^}\);$/" | sha256sum` gives
  7b23e6ddb3d8caae9251898c248ce1fc3ef7da3c73ce2eeffbed1befcd728adb; the head's block hashes the same. It holds
  `at(0.5) - node(0.5) <= 50` and `at(0.95) - node(0.95) <= 200` over 15 bare node starts.
- `git rev-parse c33644a2:<path>` for `plugins/harness/test/capture.test.mjs` (73b9606), `helpers.mjs` (4388c6e) and
  `plugins/harness/scripts/capture.mjs` (cc46a70) equal `git hash-object` of the head's files: the name, the body
  and how it measures are unchanged, and `git diff c33644a2 2d33a0f -- plugins` is empty.
