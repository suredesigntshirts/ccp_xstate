# still-catches-slow

Test: `node --test verify/capture-cheap-serial/still-catches-slow.test.mjs` (2 tests).

The edit (in lib.mjs as `slowCapture`, in record.mjs as `--slow-capture`): after
`  const event = input.hook_event_name;` in `plugins/harness/scripts/capture.mjs`, capture busy-waits 250 ms on the
first PostToolUse run for each `CCP_HARNESS_DIR` (a marker file per project folder), so the cheap test's five
measured PostToolUse runs hold one slow one wherever it runs.

- In a temp clone with the edit, the first command over capture.test.mjs reports nothing for the cheap test; the
  second exits non-zero with the cheap test `not ok` on its p95 bar, the median bar holding.
- Full npm test at 2d33a0f with the edit: parallel pass exit 0 (262 files, failures []),
  serial pass exit 1, failure message ['p95 284 ms, of which a bare node start is 29 ms'].
- First attempt (not used): a marker keyed by the hook input's `cwd` was one marker for every test, since the fixture
  events carry the recorded cwd, so the one wait landed in the parallel pass and the serial pass passed.

Recorded with `node verify/capture-cheap-serial/record.mjs <label> <sha> [--slow-capture] > <label>.json` from the
verifier's checkout (full history, `npm ci`), then summed with `node verify/capture-cheap-serial/summarize.mjs`. Each
run is a fresh `git clone --no-hardlinks` of the checkout at the sha, with the checkout's `node_modules` linked in; the
commands of `package.json`'s `test` script run one after the other (as `&&` runs them, stopping at the first non-zero
exit) by `sh -c`, with `NODE_TEST_CONTEXT` removed, the TAP reporter and `reporter.mjs` (one JSON line per finished
test) added after `node --test`. Machine: 4 CPUs, Node 22.23.4, nothing else running. Runs were one at a time,
2026-11-08 14:11-15:05Z.

```json
{"sha":"2d33a0fe648d2c2bfc58715e55cce76e8204c0f5","passes":[{"command":"node --test --test-skip-pattern=\"^cheap: \" \"test/**/*.test.mjs\" \"scripts/**/*.test.mjs\" \"packages/**/*.test.{js,mjs}\" \"plugins/**/*.test.{js,mjs}\" \"verify/**/*.test.{js,mjs}\"","start":1794149791789,"end":1794150314252,"code":0,"files":262,"tests":2076,"cheap":[],"fail":[],"failMsgs":[]},{"command":"node --test --test-concurrency=1 --test-name-pattern=\"^cheap: \" plugins/harness/test/capture.test.mjs","start":1794150314260,"end":1794150315955,"code":1,"files":1,"tests":1,"cheap":["fail"],"fail":["plugins/harness/test/capture.test.mjs :: cheap: hook.run rows show at most 50 ms median and 200 ms p95 over a bare node start per tool call"],"failMsgs":["p95 284 ms, of which a bare node start is 29 ms"]}]}
```
