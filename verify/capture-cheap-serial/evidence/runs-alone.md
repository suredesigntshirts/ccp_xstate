# runs-alone

Test: `node --test verify/capture-cheap-serial/runs-alone.test.mjs` (4 tests).

- The head's script is two commands: `node --test --test-skip-pattern="^cheap: " <the base's five globs>` and
  `node --test --test-concurrency=1 --test-name-pattern="^cheap: " plugins/harness/test/capture.test.mjs`.
- `git ls-files` finds `test('cheap: ` only in `plugins/harness/test/capture.test.mjs`.
- Run over capture.test.mjs alone in a temp clone, the first command reports no result for the cheap test (the skip
  pattern leaves it out of the report entirely, not even as `# SKIP`), the second reports one test, the cheap one.
- Three full runs at 2d33a0f: the serial pass started [10, 12, 8] ms after the parallel pass ended, ran one test (the
  cheap one, `pass`), and the parallel pass (262 files, 2076 top-level tests, exit 0) held no row for it.

Recorded with `node verify/capture-cheap-serial/record.mjs <label> <sha> [--slow-capture] > <label>.json` from the
verifier's checkout (full history, `npm ci`), then summed with `node verify/capture-cheap-serial/summarize.mjs`. Each
run is a fresh `git clone --no-hardlinks` of the checkout at the sha, with the checkout's `node_modules` linked in; the
commands of `package.json`'s `test` script run one after the other (as `&&` runs them, stopping at the first non-zero
exit) by `sh -c`, with `NODE_TEST_CONTEXT` removed, the TAP reporter and `reporter.mjs` (one JSON line per finished
test) added after `node --test`. Machine: 4 CPUs, Node 22.23.4, nothing else running. Runs were one at a time,
2026-11-08 14:11-15:05Z.

```json
{"runs":[{"sha":"2d33a0fe648d2c2bfc58715e55cce76e8204c0f5","passes":[{"command":"node --test --test-skip-pattern=\"^cheap: \" \"test/**/*.test.mjs\" \"scripts/**/*.test.mjs\" \"packages/**/*.test.{js,mjs}\" \"plugins/**/*.test.{js,mjs}\" \"verify/**/*.test.{js,mjs}\"","start":1794147612034,"end":1794148145837,"code":0,"files":262,"tests":2076,"cheap":[],"fail":[],"failMsgs":[]},{"command":"node --test --test-concurrency=1 --test-name-pattern=\"^cheap: \" plugins/harness/test/capture.test.mjs","start":1794148145847,"end":1794148147418,"code":0,"files":1,"tests":1,"cheap":["pass"],"fail":[],"failMsgs":[]}]},{"sha":"2d33a0fe648d2c2bfc58715e55cce76e8204c0f5","passes":[{"command":"node --test --test-skip-pattern=\"^cheap: \" \"test/**/*.test.mjs\" \"scripts/**/*.test.mjs\" \"packages/**/*.test.{js,mjs}\" \"plugins/**/*.test.{js,mjs}\" \"verify/**/*.test.{js,mjs}\"","start":1794148154371,"end":1794148703450,"code":0,"files":262,"tests":2076,"cheap":[],"fail":[],"failMsgs":[]},{"command":"node --test --test-concurrency=1 --test-name-pattern=\"^cheap: \" plugins/harness/test/capture.test.mjs","start":1794148703462,"end":1794148704735,"code":0,"files":1,"tests":1,"cheap":["pass"],"fail":[],"failMsgs":[]}]},{"sha":"2d33a0fe648d2c2bfc58715e55cce76e8204c0f5","passes":[{"command":"node --test --test-skip-pattern=\"^cheap: \" \"test/**/*.test.mjs\" \"scripts/**/*.test.mjs\" \"packages/**/*.test.{js,mjs}\" \"plugins/**/*.test.{js,mjs}\" \"verify/**/*.test.{js,mjs}\"","start":1794148712832,"end":1794149224768,"code":0,"files":262,"tests":2076,"cheap":[],"fail":[],"failMsgs":[]},{"command":"node --test --test-concurrency=1 --test-name-pattern=\"^cheap: \" plugins/harness/test/capture.test.mjs","start":1794149224776,"end":1794149225979,"code":0,"files":1,"tests":1,"cheap":["pass"],"fail":[],"failMsgs":[]}]}]}
```
