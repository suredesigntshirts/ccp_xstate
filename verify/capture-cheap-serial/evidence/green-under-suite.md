# green-under-suite

Test: `node --test verify/capture-cheap-serial/green-under-suite.test.mjs` (2 tests).

- `node --test plugins/harness/test/capture.test.mjs` on its own reports the cheap test `ok` (not skipped).
- Three full runs at 2d33a0f exit 0 in both passes; the cheap test passes in the serial pass each time (3 of 3). The
  done suites that run it by file (`verify/test-fixture-edges/p95-over-bare.test.mjs`) pass in the parallel pass.

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
