# faster

Command: `node verify/fast-test-clones-and-setup/record.mjs <base clone> <head clone> <out.json> 3`, and
`node --test verify/fast-test-clones-and-setup/faster.test.mjs` at be40cff22a443e1d5be0f9dd0ac1cce00837e00b.

Excerpt: each file run alone with `node --test --test-reporter=tap`, its `# duration_ms`, base then head, three
rounds (no-self-edit / self-edit-check / setup, seconds):

- round 1: base 59.3 / 361.0 / 8.3 = 428.6; head 17.2 / 103.0 / 3.7 = 124.0
- round 2: base 47.9 / 368.1 / 8.5 = 424.5; head 17.7 / 112.5 / 3.8 = 134.1
- round 3: base 51.9 / 370.1 / 8.1 = 430.1; head 16.3 / 106.4 / 3.6 = 126.3

Medians: base 428.6 s, head 126.3 s, head/base 0.295 (bar 0.60). faster.test.mjs, 1 pass: a lean clone checks out
931 of the 9,794 files a plain clone checks out.

Inputs: as same-tests.md; base 4f221631407e919218e0726147a431dd94a9fd15, head be40cff22a443e1d5be0f9dd0ac1cce00837e00b.
