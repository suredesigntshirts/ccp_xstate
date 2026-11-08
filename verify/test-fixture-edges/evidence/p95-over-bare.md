# p95-over-bare

Command: `node --test verify/test-fixture-edges/p95-over-bare.test.mjs`, at af64a367c242b66cf968aad168b40e5141d029a3.

Inputs: clones of the checkout. Slow starts: a module `const t = Date.now(); while (Date.now() - t < 300) {}` passed by
`--import` on runHook's spawn (plugins/harness/test/helpers.mjs) and on the cheap test's bare start. Slow capture: in
plugins/harness/scripts/capture.mjs, after `const event = input.hook_event_name;`, busy-wait 250 ms on the first
PostToolUse run (a marker file in a temp folder). Each runs
`node --test --test-name-pattern=cheap plugins/harness/test/capture.test.mjs`.

Excerpt:

```
ok 1 - a 300 ms start delay on both spawns: the cheap test passes at the head
# pass 1 fail 0
ok 2 - the same delay with the build change taken out: the cheap test fails on p95
# pass 0 fail 1 p95 340 ms
ok 3 - capture busy-waiting 250 ms on one PostToolUse run: the cheap test fails on p95 at the head
# pass 0 fail 1 p95 288 ms, of which a bare node start is 31 ms
```

In 2 and 3 the median assertion held (the test asserts no "median N ms" message).
