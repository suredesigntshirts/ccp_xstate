# others-parallel

Test: `node --test verify/capture-cheap-serial/others-parallel.test.mjs` (2 tests).

- The head's first command is the base's script (c33644a) with only `--test-skip-pattern="^cheap: "` added: same five
  globs, no `--test-concurrency`, so node's default (CPUs - 1).
- Base npm test at c33644a: 261 files, 2074 top-level tests, exit 0. Head parallel
  pass (run head1): 262 files, 2076 tests, exit 0. No base file is missing; the one
  added file is `test/test-passes.test.mjs`, the builder's own test, whose 3 tests pass and are not compared.
- Per test (file :: name), the only result that differs is the cheap test: `pass` at the base, absent (skipped by
  pattern) at the head. No flaky test differed in these runs, so `flaky` is empty.
- First attempt (not used): runs from `git worktree`s shared the repo's branches, and
  `packages/engine/test/standin.test.js` failed in every run after the first on `run/it*` branches and worktrees an
  earlier run left beside the checkout. Fresh clones fixed it; that leftover is the suite's, not this item's.

Recorded with `node verify/capture-cheap-serial/record.mjs <label> <sha> [--slow-capture] > <label>.json` from the
verifier's checkout (full history, `npm ci`), then summed with `node verify/capture-cheap-serial/summarize.mjs`. Each
run is a fresh `git clone --no-hardlinks` of the checkout at the sha, with the checkout's `node_modules` linked in; the
commands of `package.json`'s `test` script run one after the other (as `&&` runs them, stopping at the first non-zero
exit) by `sh -c`, with `NODE_TEST_CONTEXT` removed, the TAP reporter and `reporter.mjs` (one JSON line per finished
test) added after `node --test`. Machine: 4 CPUs, Node 22.23.4, nothing else running. Runs were one at a time,
2026-11-08 14:11-15:05Z.

```json
{"base":{"sha":"c33644a28c3523bf65edcb6e9023dac1e194ca75","code":0,"files":261,"filesHash":"fec86fd7fb212c1002aa1601a15e793e3031aa97e8ace6c586dd1405942cc52e","tests":2074},"head":{"sha":"2d33a0fe648d2c2bfc58715e55cce76e8204c0f5","code":0,"files":262,"filesHash":"3c17dc7e6c1095e0eaf1075e2cd236393378cf239b5e12a1696fbd8e611258c8","tests":2076},"added":["test/test-passes.test.mjs"],"missing":[],"changed":[{"key":"plugins/harness/test/capture.test.mjs :: cheap: hook.run rows show at most 50 ms median and 200 ms p95 over a bare node start per tool call","base":"pass","head":"absent"}],"flaky":[]}
```
